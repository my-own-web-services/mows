use crate::{
    config::config,
    crd::{VaultResource, VaultResourceSpec, VaultResourceStatus},
    handlers::{
        auth_engine::{apply_auth_engine, cleanup_auth_engine},
        policy::{apply_engine_access_policy, cleanup_engine_access_policy},
        secret_engine::{apply_secret_engine, cleanup_secret_engine},
        secret_sync::{apply_secret_sync, cleanup_secret_sync},
    },
    utils::{create_vault_client, get_error_type},
    ControllerError, Metrics, Result,
};
use anyhow::{anyhow, Context as AnyhowContext};
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
pub static FINALIZER: &str = "vaultresources.k8s.mows.cloud";

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

#[instrument(skip(ctx, vault_resource), fields(trace_id), level = "trace")]
async fn reconcile(vault_resource: Arc<VaultResource>, ctx: Arc<Context>) -> Result<Action> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = vault_resource.namespace().unwrap(); // vault resources are namespace scoped
    let vault_resources: Api<VaultResource> = Api::namespaced(ctx.client.clone(), &ns);

    //info!("Reconciling Object \"{}\" in {}", vault_resource.name_any(), ns);
    finalizer(&vault_resources, FINALIZER, vault_resource, |event| async {
        match event {
            Finalizer::Apply(res) => res.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(res) => res.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| ControllerError::FinalizerError(Box::new(e)))
}

#[instrument(skip(kube_client), level = "trace")]
pub async fn cleanup_resource(
    vault_resource: &VaultResource,
    kube_client: &kube::Client,
) -> Result<(), ControllerError> {
    let vault_client = create_vault_client().await?;

    let resource_namespace = vault_resource.metadata.namespace.as_deref().unwrap_or("default");

    let resource_name = match vault_resource.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(ControllerError::GenericError(anyhow!(
                "Failed to get resource name from VaultResource metadata".to_string()
            )))
        }
    };

    match &vault_resource.spec {
        VaultResourceSpec::SecretEngine(vault_secret_engine) => {
            cleanup_secret_engine(
                &vault_client,
                resource_namespace,
                resource_name,
                vault_secret_engine,
            )
            .await?
        }
        VaultResourceSpec::AuthEngine(_) => {
            cleanup_auth_engine(&vault_client, resource_namespace, resource_name).await?
        }
        VaultResourceSpec::EngineAccessPolicy(_) => {
            cleanup_engine_access_policy(&vault_client, resource_namespace, resource_name).await?
        }
        VaultResourceSpec::SecretSync(vault_secret_sync) => {
            cleanup_secret_sync(kube_client, resource_namespace, vault_secret_sync).await?
        }
    }

    Ok(())
}

#[instrument(skip(kube_client), level = "trace")]
pub async fn apply_resource(
    vault_resource: &VaultResource,
    kube_client: &kube::Client,
) -> Result<(), ControllerError> {
    let vault_client = create_vault_client().await?;

    let resource_namespace = vault_resource.metadata.namespace.as_deref().unwrap_or("default");

    let resource_name = match vault_resource.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(ControllerError::GenericError(anyhow!(
                "Failed to get resource name from VaultResource metadata".to_string(),
            )))
        }
    };

    match &vault_resource.spec {
        VaultResourceSpec::SecretEngine(vault_secret_engine) => apply_secret_engine(
            &vault_client,
            resource_namespace,
            resource_name,
            vault_secret_engine,
        )
        .await
        .context("Failed to apply secret engine.")?,
        VaultResourceSpec::AuthEngine(vault_auth_engine) => apply_auth_engine(
            &vault_client,
            resource_namespace,
            resource_name,
            vault_auth_engine,
        )
        .await
        .context("Failed to apply auth engine.")?,
        VaultResourceSpec::EngineAccessPolicy(vault_engine_access_policy) => apply_engine_access_policy(
            &vault_client,
            resource_namespace,
            resource_name,
            vault_engine_access_policy,
        )
        .await
        .context("Failed to apply engine access policy.")?,
        VaultResourceSpec::SecretSync(vault_secret_sync) => {
            let force_target_namespace_key = "vault.k8s.mows.cloud/force-target-namespace";
            let sudo_key = "k8s.mows.cloud/sudo";

            let mut target_namespace = resource_namespace;
            if let Some(labels) = &vault_resource.metadata.labels {
                if let Some(force_target_namespace_some) = labels.get(force_target_namespace_key) {
                    if let Some(sudo) = labels.get(sudo_key) {
                        if sudo == "true" {
                            target_namespace = force_target_namespace_some;
                        } else {
                            return Err(ControllerError::GenericError(anyhow!(format!(
                                "The `{}` label is only allowed with `{}` label set to `true`",
                                force_target_namespace_key, sudo_key
                            ))));
                        };
                    }
                };
            };
            apply_secret_sync(
                &vault_client,
                resource_namespace,
                resource_name,
                &target_namespace,
                vault_secret_sync,
                kube_client,
            )
            .await
            .context("Failed to apply secret sync.")?
        }
    }

    Ok(())
}

fn error_policy(
    vault_resource: Arc<VaultResource>,
    error: &ControllerError,
    ctx: Arc<Context>,
    reconcile_interval_seconds: u64,
) -> Action {
    warn!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&vault_resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}

impl VaultResource {
    // Reconcile (for non-finalizer related changes)
    #[instrument(skip(ctx), level = "trace")]
    async fn reconcile(&self, ctx: Arc<Context>) -> Result<Action> {
        let kube_client = ctx.client.clone();
        let recorder = ctx.diagnostics.read().await.recorder(kube_client.clone(), self);
        let ns = self.namespace().unwrap();
        let name = self.name_any();
        let vault_resources: Api<VaultResource> = Api::namespaced(kube_client.clone(), &ns);

        match apply_resource(self, &kube_client).await {
            Ok(_) => {
                let new_status = Patch::Apply(json!({
                    "apiVersion": "vault.k8s.mows.cloud/v1",
                    "kind": "VaultResource",
                    "status": VaultResourceStatus {
                        created: true
                    }
                }));

                let ps = PatchParams::apply(FINALIZER).force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(ControllerError::KubeError)?;

                // TODO differentiate between create and update, return the correct event from apply_resource

                recorder
                    .publish(Event {
                        type_: EventType::Normal,
                        reason: "ObjectCreated".into(),
                        note: Some(format!("Object Created: `{name}`")),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(ControllerError::KubeError)?;
            }
            Err(e) => {
                error!("Reconcile failed: {:?}", e);
                let new_status = Patch::Apply(json!({
                    "apiVersion": "vault.k8s.mows.cloud/v1",
                    "kind": "VaultResource",
                    "status": VaultResourceStatus {
                        created: false
                    }
                }));

                let ps = PatchParams::apply(FINALIZER).force();
                vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(ControllerError::KubeError)?;

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
                    .map_err(ControllerError::KubeError)?;
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
    #[instrument(skip(ctx), level = "trace")]
    async fn cleanup(&self, ctx: Arc<Context>) -> Result<Action> {
        let recorder = ctx.diagnostics.read().await.recorder(ctx.client.clone(), self);

        cleanup_resource(self, &ctx.client).await?;

        let res = recorder
            .publish(Event {
                type_: EventType::Normal,
                reason: "CleanupRequested".into(),
                note: Some(format!("Delete `{}`", self.name_any())),
                action: "Cleanup".into(),
                secondary: None,
            })
            .await
            .map_err(ControllerError::KubeError);

        error!("Failed to publish event: {:?}", res);

        let config = get_current_config_cloned!(config());

        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
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
            reporter: "vault-resource-controller".into(),
        }
    }
}
impl Diagnostics {
    fn recorder(&self, client: Client, doc: &VaultResource) -> Recorder {
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
    let object = Api::<VaultResource>::all(client.clone());
    if let Err(e) = object.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
        std::process::exit(1);
    }

    let config = get_current_config_cloned!(config());

    Controller::new(object, Config::default().any_semantic())
        .shutdown_on_signal()
        .run(
            reconcile,
            |vault_resource, error, ctx| {
                error_policy(vault_resource, error, ctx, config.reconcile_interval_seconds)
            },
            state.to_context(client),
        )
        .filter_map(|x| async move { std::result::Result::ok(x) })
        .for_each(|_| futures::future::ready(()))
        .await;
}
