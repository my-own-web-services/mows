use crate::{
    config::config,
    crd::{PektinResource, PektinResourceSpec, PektinResourceStatus},
    reconcile::plain::handle_plain,
    utils::get_error_type,
    ControllerError, Metrics, Result,
};
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
use mows_common_rust::{get_current_config_cloned, observability::get_trace_id, vault::ManagedVaultClient};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tokio::{sync::RwLock, time::Duration};
use tracing::*;

pub static FINALIZER: &str = "pektin.k8s.mows.cloud";

#[instrument(skip(controller_context), fields(trace_id), level = "trace")]
pub async fn reconcile_resource(
    controller_context: &Arc<ControllerContext>,
    pektin_dns: &PektinResource,
) -> Result<(), ControllerError> {
    // let resource_namespace = pektin_dns.metadata.namespace.as_deref().unwrap_or("default");

    // let resource_name = match pektin_dns.metadata.name.as_deref() {
    //     Some(v) => v,
    //     None => {
    //         return Err(ControllerError::GenericError(
    //             "Failed to get resource name from PektinResource metadata".to_string(),
    //         ))
    //     }
    // };
    let vault_token = controller_context.vault_client.get_token().await?;

    let result = match &pektin_dns.spec {
        PektinResourceSpec::Plain(db_entries) => handle_plain(&vault_token, db_entries).await,
    };

    result
}

// Context for our reconciler
#[derive(Clone)]
pub struct ControllerContext {
    /// Kubernetes client
    pub kubernetes_client: Client,
    /// Diagnostics read by the web server
    pub diagnostics: Arc<RwLock<Diagnostics>>,
    /// Prometheus metrics
    pub metrics: Arc<Metrics>,
    /// Managed Vault client with automatic token renewal
    pub vault_client: ManagedVaultClient,
}

#[instrument(skip(controller_context), fields(trace_id))]
async fn reconcile(
    resource: Arc<PektinResource>,
    controller_context: Arc<ControllerContext>,
) -> Result<Action> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = controller_context.metrics.reconcile.count_and_measure(&trace_id);
    controller_context.diagnostics.write().await.last_event = Utc::now();
    let ns = resource.namespace().unwrap();
    let pektin_dns_resources_api: Api<PektinResource> =
        Api::namespaced(controller_context.kubernetes_client.clone(), &ns);

    info!("Reconciling Document \"{}\" in {}", resource.name_any(), ns);
    finalizer(&pektin_dns_resources_api, FINALIZER, resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(controller_context.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(controller_context.clone()).await,
        }
    })
    .await
    .map_err(|e| ControllerError::FinalizerError(Box::new(e)))
}

fn error_policy(
    resource: Arc<PektinResource>,
    error: &ControllerError,
    controller_context: Arc<ControllerContext>,
    reconcile_interval_seconds: u64,
) -> Action {
    warn!("reconcile failed: {:?}", error);
    controller_context.metrics.reconcile.set_failure(&resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}

impl PektinResource {
    // Reconcile (for non-finalizer related changes)
    #[instrument(skip(controller_context))]
    async fn reconcile(&self, controller_context: Arc<ControllerContext>) -> Result<Action> {
        let kube_client = controller_context.kubernetes_client.clone();
        let recorder = controller_context
            .diagnostics
            .read()
            .await
            .recorder(kube_client.clone(), self);
        let ns = self.namespace().unwrap();
        let name = self.name_any();
        let pektin_resources_api: Api<PektinResource> = Api::namespaced(kube_client.clone(), &ns);

        match reconcile_resource(&controller_context, self).await {
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
                    .map_err(ControllerError::KubeError)?;

                recorder
                    .publish(Event {
                        type_: EventType::Normal,
                        reason: "ResourceCreated".into(),
                        note: Some(format!("Resource created: `{name}`")),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(ControllerError::KubeError)?;
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
                    .map_err(ControllerError::KubeError)?;

                let mut reason = get_error_type(&e);
                reason.truncate(128);
                let mut note = e.to_string();
                note.truncate(1024);

                recorder
                    .publish(Event {
                        type_: EventType::Warning,
                        reason,
                        note: Some(note),
                        action: "CreatePektinResource".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(ControllerError::KubeError)?;
                return Err(e);
            }
        }

        let config = get_current_config_cloned!(config());

        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
    }

    // Finalizer cleanup (the object was deleted, ensure nothing is orphaned)
    async fn cleanup(&self, controller_context: Arc<ControllerContext>) -> Result<Action> {
        let recorder = controller_context
            .diagnostics
            .read()
            .await
            .recorder(controller_context.kubernetes_client.clone(), self);
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
#[derive(Clone)]
pub struct ControllerWebServerSharedState {
    /// Diagnostics populated by the reconciler
    diagnostics: Arc<RwLock<Diagnostics>>,
    /// Metrics
    metrics: Arc<Metrics>,
    /// Managed Vault client with automatic token renewal
    vault_client: ManagedVaultClient,
}

/// State wrapper around the controller outputs for the web server
impl ControllerWebServerSharedState {
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
    pub fn to_context(&self, client: Client) -> Arc<ControllerContext> {
        Arc::new(ControllerContext {
            kubernetes_client: client,
            metrics: self.metrics.clone(),
            diagnostics: self.diagnostics.clone(),
            vault_client: self.vault_client.clone(),
        })
    }

    /// Create a new controller state with vault client
    pub async fn new() -> Result<Self, mows_common_rust::vault::ManagedVaultError> {
        let config = get_current_config_cloned!(config());

        let vault_config = mows_common_rust::vault::VaultConfig {
            address: config.vault_url,
            auth_method: mows_common_rust::vault::VaultAuthMethod::Kubernetes {
                service_account_token_path: config.service_account_token_path,
                auth_path: config.vault_kubernetes_api_auth_path,
                auth_role: config.pektin_username,
            },
            renewal_threshold: 0.8,
        };

        let vault_client = ManagedVaultClient::new(vault_config).await?;

        Ok(Self {
            diagnostics: Arc::new(RwLock::new(Diagnostics::default())),
            metrics: Arc::new(Metrics::default()),
            vault_client,
        })
    }
}

/// Initialize the controller and shared state (given the crd is installed)
pub async fn run(shared_state: ControllerWebServerSharedState) {
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
            |pektin_resource, error, controller_context| {
                error_policy(
                    pektin_resource,
                    error,
                    controller_context,
                    config.reconcile_interval_seconds,
                )
            },
            shared_state.to_context(client),
        )
        .filter_map(|x| async move { std::result::Result::ok(x) })
        .for_each(|_| futures::future::ready(()))
        .await;
}
