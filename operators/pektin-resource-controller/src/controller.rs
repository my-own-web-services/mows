use crate::{
    config::config,
    crd::{PektinResource, PektinResourceSpec, PektinResourceStatus},
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

use mows_common_rust::{
    get_current_config_cloned,
    observability::get_trace_id,
    vault::{ManagedVaultClient, VaultAuthMethod, VaultConfig},
};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tokio::{sync::RwLock, time::Duration};
use tracing::*;

pub static FINALIZER: &str = "pektin.k8s.mows.cloud";

pub async fn get_vault_token() -> Result<(String, ManagedVaultClient), Error> {
    let config = get_current_config_cloned!(config());

    let vault_config = VaultConfig {
        address: config.vault_url,
        auth_method: VaultAuthMethod::Kubernetes {
            service_account_token_path: config.service_account_token_path,
            auth_path: config.vault_kubernetes_api_auth_path,
            auth_role: config.pektin_username,
        },
        renewal_threshold: 0.8,
    };

    let managed_client = ManagedVaultClient::new(vault_config)
        .await
        .map_err(|e| Error::GenericError(format!("Failed to create managed vault client: {}", e)))?;

    // Get the token from the managed client's state
    let client = managed_client
        .get_client()
        .await
        .map_err(|e| Error::GenericError(format!("Failed to get vault client: {}", e)))?;

    // Unfortunately, we can't extract the token from VaultClient directly
    // For now, we'll need to use a different approach - let's look up the token
    let token_info = vaultrs::token::lookup_self(&client)
        .await
        .map_err(|e| Error::GenericError(format!("Failed to lookup token: {}", e)))?;

    // Return both token and managed client so the token can be revoked later
    Ok((token_info.id, managed_client))
}

#[instrument(skip(kube_client))]
pub async fn reconcile_resource(
    pektin_dns: &PektinResource,
    kube_client: &kube::Client,
) -> Result<(), Error> {
    let (vault_token, managed_client) = get_vault_token().await?;
    let resource_namespace = pektin_dns.metadata.namespace.as_deref().unwrap_or("default");

    let resource_name = match pektin_dns.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(Error::GenericError(
                "Failed to get resource name from PektinResource metadata".to_string(),
            ))
        }
    };

    let result = match &pektin_dns.spec {
        PektinResourceSpec::Plain(db_entries) => handle_plain(&vault_token, db_entries).await,
    };

    // Revoke the token to prevent lease accumulation
    if let Err(e) = managed_client.revoke_token().await {
        warn!("Failed to revoke vault token: {}", e);
    }

    result
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
async fn reconcile(resource: Arc<PektinResource>, ctx: Arc<Context>) -> Result<Action> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = resource.namespace().unwrap();
    let pektin_dns_resources_api: Api<PektinResource> = Api::namespaced(ctx.client.clone(), &ns);

    info!("Reconciling Document \"{}\" in {}", resource.name_any(), ns);
    finalizer(&pektin_dns_resources_api, FINALIZER, resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| Error::FinalizerError(Box::new(e)))
}

fn error_policy(
    resource: Arc<PektinResource>,
    error: &Error,
    ctx: Arc<Context>,
    reconcile_interval_seconds: u64,
) -> Action {
    warn!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}

impl PektinResource {
    // Reconcile (for non-finalizer related changes)
    #[instrument(skip(ctx))]
    async fn reconcile(&self, ctx: Arc<Context>) -> Result<Action> {
        let kube_client = ctx.client.clone();
        let recorder = ctx.diagnostics.read().await.recorder(kube_client.clone(), self);
        let ns = self.namespace().unwrap();
        let name = self.name_any();
        let pektin_resources_api: Api<PektinResource> = Api::namespaced(kube_client.clone(), &ns);

        match reconcile_resource(self, &kube_client).await {
            Ok(_) => {
                info!("Reconcile successful");
                let new_status = Patch::Apply(json!({
                    "apiVersion": "pektin.k8s.mows.cloud/v1",
                    "kind": "PektinResource",
                    "status": PektinResourceStatus {
                        created: true
                    }
                }));

                let ps = PatchParams::apply(FINALIZER).force();
                let _o = pektin_resources_api
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
                    "kind": "PektinResource",
                    "status": PektinResourceStatus {
                        created: false
                    }
                }));

                let ps = PatchParams::apply(FINALIZER).force();
                let _o = pektin_resources_api
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

        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
    }

    // Finalizer cleanup (the object was deleted, ensure nothing is orphaned)
    async fn cleanup(&self, ctx: Arc<Context>) -> Result<Action> {
        let recorder = ctx.diagnostics.read().await.recorder(ctx.client.clone(), self);
        if let Err(e) = recorder
            .publish(Event {
                type_: EventType::Normal,
                reason: "DeleteRequested".into(),
                note: Some(format!("Delete `{}`", self.name_any())),
                action: "Deleting".into(),
                secondary: None,
            })
            .await
        {
            error!("Failed to publish delete event: {:?}", e);
        };
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
            reporter: "pektin-resource-controller".into(),
        }
    }
}
impl Diagnostics {
    fn recorder(&self, client: Client, doc: &PektinResource) -> Recorder {
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
    let pektin_resource = Api::<PektinResource>::all(client.clone());
    if let Err(e) = pektin_resource.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
        std::process::exit(1);
    }

    let config = get_current_config_cloned!(config());

    Controller::new(pektin_resource, Config::default().any_semantic())
        .shutdown_on_signal()
        .run(
            reconcile,
            |pektin_resource, error, ctx| {
                error_policy(pektin_resource, error, ctx, config.reconcile_interval_seconds)
            },
            state.to_context(client),
        )
        .filter_map(|x| async move { std::result::Result::ok(x) })
        .for_each(|_| futures::future::ready(()))
        .await;
}
