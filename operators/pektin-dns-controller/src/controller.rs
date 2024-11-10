use crate::{
    config::{self, config},
    crd::{PektinDns, PektinDnsSpec, PektinDnsStatus},
    reconcile::plain::handle_plain,
    utils::get_error_type,
    Error, Metrics, Result,
};
use anyhow::Context as anyhow_context;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use kube::{
    api::{Api, ListParams, Patch, PatchParams, ResourceExt},
    client::Client,
    runtime::{
        controller::{Action, Controller},
        events::{Event, EventType, Recorder, Reporter},
        finalizer::{finalizer, Event as Finalizer},
        watcher::Config,
    },
    Resource,
};

use mows_common::{get_current_config_cloned, observability::get_trace_id};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tokio::{sync::RwLock, time::Duration};
use tracing::*;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};

pub static FINALIZER: &str = "pektin.k8s.mows.cloud";

pub async fn get_vault_token() -> Result<String, Error> {
    let config = get_current_config_cloned!(config());
    let mut client_builder = VaultClientSettingsBuilder::default();

    client_builder.address(config.vault_uri);

    let vc =
        VaultClient::new(client_builder.build().map_err(|_| {
            Error::GenericError("Failed to create vault client settings builder".to_string())
        })?)?;

    let service_account_jwt = std::fs::read_to_string(&config.service_account_token_path)
        .context("Failed to read service account token")?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        &config.vault_kubernetes_api_auth_path,
        &config.pektin_username,
        &service_account_jwt,
    )
    .await?;

    Ok(vault_auth.client_token)
}

#[instrument(skip(kube_client))]
pub async fn reconcile_resource(pektin_dns: &PektinDns, kube_client: &kube::Client) -> Result<(), Error> {
    let vault_token = get_vault_token().await?;
    let resource_namespace = pektin_dns.metadata.namespace.as_deref().unwrap_or("default");

    let resource_name = match pektin_dns.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(Error::GenericError(
                "Failed to get resource name from PektinDns metadata".to_string(),
            ))
        }
    };

    match &pektin_dns.spec {
        PektinDnsSpec::Plain(db_entries) => handle_plain(&vault_token, db_entries).await?,
    }

    Ok(())
}

// Context for our reconciler
#[derive(Clone)]
pub struct Context {
    /// Kubernetes client
    pub client: Client,
    /// Diagnostics read by the web server
    pub diagnostics: Arc<RwLock<Diagnostics>>,
    /// Prometheus metrics
    pub metrics: Arc<Metrics>,
}

#[instrument(skip(ctx), fields(trace_id))]
async fn reconcile(vault_resource: Arc<PektinDns>, ctx: Arc<Context>) -> Result<Action> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = vault_resource.namespace().unwrap(); // vault resources are namespace scoped
    let vault_resources: Api<PektinDns> = Api::namespaced(ctx.client.clone(), &ns);

    info!("Reconciling Document \"{}\" in {}", vault_resource.name_any(), ns);
    finalizer(&vault_resources, FINALIZER, vault_resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| Error::FinalizerError(Box::new(e)))
}

fn error_policy(vault_resource: Arc<PektinDns>, error: &Error, ctx: Arc<Context>) -> Action {
    warn!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&vault_resource, error);

    Action::requeue(Duration::from_secs(30))
}

impl PektinDns {
    // Reconcile (for non-finalizer related changes)
    #[instrument(skip(ctx))]
    async fn reconcile(&self, ctx: Arc<Context>) -> Result<Action> {
        let kube_client = ctx.client.clone();
        let recorder = ctx.diagnostics.read().await.recorder(kube_client.clone(), self);
        let ns = self.namespace().unwrap();
        let name = self.name_any();
        let vault_resources: Api<PektinDns> = Api::namespaced(kube_client.clone(), &ns);

        match reconcile_resource(self, &kube_client).await {
            Ok(_) => {
                info!("Reconcile successful");
                let new_status = Patch::Apply(json!({
                    "apiVersion": "pektin.k8s.mows.cloud/v1",
                    "kind": "PektinDns",
                    "status": PektinDnsStatus {
                        created: true
                    }
                }));

                let ps = PatchParams::apply("cntrlr").force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(Error::KubeError)?;

                recorder
                    .publish(Event {
                        type_: EventType::Normal,
                        reason: "ObjectCreated".into(),
                        note: Some(format!("Object Created: `{name}`")),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(Error::KubeError)?;
            }
            Err(e) => {
                error!("Reconcile failed: {:?}", e);
                let new_status = Patch::Apply(json!({
                    "apiVersion": "pektin.k8s.mows.cloud/v1",
                    "kind": "PektinDns",
                    "status": PektinDnsStatus {
                        created: false
                    }
                }));

                let ps = PatchParams::apply("cntrlr").force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(Error::KubeError)?;

                let reason = get_error_type(&e);

                recorder
                    .publish(Event {
                        type_: EventType::Warning,
                        reason,
                        note: Some(e.to_string()),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(Error::KubeError)?;
                return Err(e);
            }
        }

        let config = get_current_config_cloned!(config());

        // If no events were received, check back every 5 minutes
        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
    }

    // Finalizer cleanup (the object was deleted, ensure nothing is orphaned)
    async fn cleanup(&self, ctx: Arc<Context>) -> Result<Action> {
        let recorder = ctx.diagnostics.read().await.recorder(ctx.client.clone(), self);
        // Document doesn't have any real cleanup, so we just publish an event
        let res = recorder
            .publish(Event {
                type_: EventType::Normal,
                reason: "DeleteRequested".into(),
                note: Some(format!("Delete `{}`", self.name_any())),
                action: "Deleting".into(),
                secondary: None,
            })
            .await
            .map_err(Error::KubeError);

        error!("Failed to publish event: {:?}", res);

        Ok(Action::await_change())
    }
}

/// Diagnostics to be exposed by the web server
#[derive(Clone, Serialize)]
pub struct Diagnostics {
    #[serde(deserialize_with = "from_ts")]
    pub last_event: DateTime<Utc>,
    #[serde(skip)]
    pub reporter: Reporter,
}
impl Default for Diagnostics {
    fn default() -> Self {
        Self {
            last_event: Utc::now(),
            reporter: "pektin-dns-controller".into(),
        }
    }
}
impl Diagnostics {
    fn recorder(&self, client: Client, doc: &PektinDns) -> Recorder {
        Recorder::new(client, self.reporter.clone(), doc.object_ref(&()))
    }
}

/// State shared between the controller and the web server
#[derive(Clone, Default)]
pub struct State {
    /// Diagnostics populated by the reconciler
    diagnostics: Arc<RwLock<Diagnostics>>,
    /// Metrics
    metrics: Arc<Metrics>,
}

/// State wrapper around the controller outputs for the web server
impl State {
    /// Metrics getter
    pub fn metrics(&self) -> String {
        let mut buffer = String::new();
        let registry = &*self.metrics.registry;
        prometheus_client::encoding::text::encode(&mut buffer, registry).unwrap();
        buffer
    }

    /// State getter
    pub async fn diagnostics(&self) -> Diagnostics {
        self.diagnostics.read().await.clone()
    }

    // Create a Controller Context that can update State
    pub fn to_context(&self, client: Client) -> Arc<Context> {
        Arc::new(Context {
            client,
            metrics: self.metrics.clone(),
            diagnostics: self.diagnostics.clone(),
        })
    }
}

/// Initialize the controller and shared state (given the crd is installed)
pub async fn run(state: State) {
    let client = Client::try_default().await.expect("failed to create kube Client");
    let docs = Api::<PektinDns>::all(client.clone());
    if let Err(e) = docs.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
        std::process::exit(1);
    }
    Controller::new(docs, Config::default().any_semantic())
        .shutdown_on_signal()
        .run(reconcile, error_policy, state.to_context(client))
        .filter_map(|x| async move { std::result::Result::ok(x) })
        .for_each(|_| futures::future::ready(()))
        .await;
}
