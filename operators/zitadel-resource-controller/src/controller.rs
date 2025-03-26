use crate::{
    config::config,
    crd::{ZitadelResource, ZitadelResourceSpec, ZitadelResourceStatus},
    handlers::raw::{apply_raw, cleanup_raw},
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
use mows_common::{get_current_config_cloned, observability::get_trace_id};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tokio::{sync::RwLock, time::Duration};
use tracing::*;

pub static FINALIZER: &str = "zitadel.k8s.mows.cloud";

#[instrument(skip(kube_client))]
pub async fn apply_resource(
    zitadel_resource: &ZitadelResource,
    kube_client: &kube::Client,
) -> Result<(), ControllerError> {
    let resource_namespace = zitadel_resource
        .metadata
        .namespace
        .as_deref()
        .unwrap_or("default");

    let resource_name = match zitadel_resource.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(ControllerError::GenericError(
                "Failed to get resource name from ZitadelResource metadata".to_string(),
            ))
        }
    };

    match &zitadel_resource.spec {
        ZitadelResourceSpec::Raw(raw_resource) => {
            apply_raw(resource_namespace, resource_name, raw_resource).await?
        }
    }

    Ok(())
}

pub async fn cleanup_resource(
    zitadel_resource: &ZitadelResource,
    kube_client: &kube::Client,
) -> Result<(), ControllerError> {
    let resource_namespace = zitadel_resource
        .metadata
        .namespace
        .as_deref()
        .unwrap_or("default");

    let resource_name = match zitadel_resource.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(ControllerError::GenericError(
                "Failed to get resource name from ZitadelResource metadata".to_string(),
            ))
        }
    };

    match &zitadel_resource.spec {
        ZitadelResourceSpec::Raw(raw_resource) => {
            cleanup_raw(resource_namespace, resource_name, raw_resource).await?
        }
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
async fn reconcile(vault_resource: Arc<ZitadelResource>, ctx: Arc<Context>) -> Result<Action> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = vault_resource.namespace().unwrap(); // vault resources are namespace scoped
    let vault_resources: Api<ZitadelResource> = Api::namespaced(ctx.client.clone(), &ns);

    info!("Reconciling Document \"{}\" in {}", vault_resource.name_any(), ns);
    finalizer(&vault_resources, FINALIZER, vault_resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| ControllerError::FinalizerError(Box::new(e)))
}

fn error_policy(
    vault_resource: Arc<ZitadelResource>,
    error: &ControllerError,
    ctx: Arc<Context>,
    reconcile_interval_seconds: u64,
) -> Action {
    warn!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&vault_resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}

impl ZitadelResource {
    // Reconcile (for non-finalizer related changes)
    #[instrument(skip(ctx))]
    async fn reconcile(&self, ctx: Arc<Context>) -> Result<Action> {
        let kube_client = ctx.client.clone();
        let recorder = ctx.diagnostics.read().await.recorder(kube_client.clone(), self);
        let ns = self.namespace().unwrap();
        let name = self.name_any();
        let vault_resources: Api<ZitadelResource> = Api::namespaced(kube_client.clone(), &ns);

        match apply_resource(self, &kube_client).await {
            Ok(_) => {
                info!("Reconcile successful");
                let new_status = Patch::Apply(json!({
                    "apiVersion": "zitadel.k8s.mows.cloud/v1",
                    "kind": "ZitadelResource",
                    "status": ZitadelResourceStatus {
                        created: true
                    }
                }));

                let ps = PatchParams::apply(FINALIZER).force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(ControllerError::KubeError)?;

                recorder
                    .publish(Event {
                        type_: EventType::Normal,
                        reason: "ObjectCreated".into(),
                        note: Some(format!("Object Created: {name}")),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(ControllerError::KubeError)?;
            }
            Err(e) => {
                error!("Reconcile failed: {:?}", e);
                let new_status = Patch::Apply(json!({
                    "apiVersion": "zitadel.k8s.mows.cloud/v1",
                    "kind": "ZitadelResource",
                    "status": ZitadelResourceStatus {
                        created: false
                    }
                }));

                let ps = PatchParams::apply(FINALIZER).force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(ControllerError::KubeError)?;

                let mut reason = get_error_type(&e);
                reason.truncate(1000);

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
            .map_err(ControllerError::KubeError);

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
            reporter: "zitadel-controller".into(),
        }
    }
}
impl Diagnostics {
    fn recorder(&self, client: Client, doc: &ZitadelResource) -> Recorder {
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
    let zitadel_resource = Api::<ZitadelResource>::all(client.clone());
    if let Err(e) = zitadel_resource.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
        std::process::exit(1);
    }

    let config = get_current_config_cloned!(config());

    Controller::new(zitadel_resource, Config::default().any_semantic())
        .shutdown_on_signal()
        .run(
            reconcile,
            |zitadel_resource, error, ctx| {
                error_policy(zitadel_resource, error, ctx, config.reconcile_interval_seconds)
            },
            state.to_context(client),
        )
        .filter_map(|x| async move { std::result::Result::ok(x) })
        .for_each(|_| futures::future::ready(()))
        .await;
}
