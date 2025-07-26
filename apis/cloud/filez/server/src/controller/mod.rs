use crate::{
    config::config,
    database::Database,
    errors::{get_error_type, FilezError},
    models::{apps::MowsApp, storage_locations::StorageLocation},
    state::{ServerState, StorageLocationState},
};
use chrono::{DateTime, Utc};
use crd::{FilezResource, FilezResourceSpec, FilezResourceStatus, SecretReadableByFilezController};
use futures::StreamExt;
use kube::{
    api::{Api, ListParams, Patch, PatchParams},
    runtime::{
        controller::Action,
        events::{Event, EventType, Recorder, Reporter},
        finalizer::{finalizer, Event as Finalizer},
        watcher::Config,
        Controller,
    },
    Client, Resource, ResourceExt,
};
use metrics::Metrics;
use mows_common_rust::{get_current_config_cloned, observability::get_trace_id};
use serde::Serialize;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{debug, error, field, info, instrument, Span};

pub mod crd;
pub mod metrics;

pub static FINALIZER: &str = "filez.k8s.mows.cloud";

async fn inner_reconcile(
    resource: &FilezResource,
    ctx: &ControllerContext,
    name: &str,
    namespace: &str,
) -> Result<(), FilezError> {
    let full_name = format!("{}-{}", namespace, name);
    debug!("Reconcile resource: {}", full_name);
    match &resource.spec {
        FilezResourceSpec::StorageLocation(incoming_provider_config) => {
            debug!(
                "Reconcile StorageLocation resource: {} with config: {:?}",
                full_name, incoming_provider_config
            );

            let filez_secrets =
                SecretReadableByFilezController::fetch_map(&ctx.client, namespace).await?;
            debug!("Fetched secrets for resource: {}", full_name);
            debug!(
                "Creating or updating StorageLocation for resource: {} with config: {:?}",
                full_name, incoming_provider_config
            );

            StorageLocation::create_or_update(
                &ctx.storage_location_providers,
                &ctx.database,
                &full_name,
                filez_secrets,
                &incoming_provider_config,
            )
            .await?;
        }
        FilezResourceSpec::MowsApp(incoming_app) => {
            MowsApp::create_or_update(&ctx.database, incoming_app, &full_name).await?;
        }
    }
    Ok(())
}

impl FilezResource {
    async fn reconcile(&self, ctx: Arc<ControllerContext>) -> Result<Action, FilezError> {
        let kube_client = ctx.client.clone();

        let config = get_current_config_cloned!(config());
        let filez_resources_api: Api<FilezResource> =
            Api::namespaced(kube_client.clone(), &self.namespace().unwrap_or_default());
        let name = self.metadata.name.clone().ok_or_else(|| {
            FilezError::ControllerMissingResourceName(
                self.metadata.name.clone().unwrap_or_default(),
            )
        })?;

        let namespace = self
            .metadata
            .namespace
            .clone()
            .unwrap_or_else(|| "default".to_string());

        let recorder = ctx
            .diagnostics
            .read()
            .await
            .recorder(kube_client.clone(), self);

        if let Err(e) = inner_reconcile(self, &ctx, &name, &namespace).await {
            error!("Reconcile failed: {:?}", e);
            let new_status = Patch::Apply(json!({
                "apiVersion": "filez.k8s.mows.cloud/v1",
                "kind": "FilezResource",
                "status": FilezResourceStatus {
                    created: false
                }
            }));

            let ps = PatchParams::apply(FINALIZER).force();
            let _o = filez_resources_api
                .patch_status(&name, &ps, &new_status)
                .await?;

            let reason = get_error_type(&e);

            recorder
                .publish(Event {
                    type_: EventType::Warning,
                    reason,
                    note: Some(e.to_string()),
                    action: "CreateObject".into(),
                    secondary: None,
                })
                .await?;
            return Err(e);
        }

        info!("Reconcile successful");
        let new_status = Patch::Apply(json!({
              "apiVersion": "filez.k8s.mows.cloud/v1",
              "kind": "FilezResource",
              "status": FilezResourceStatus {
                created: true
            }
        }));

        let ps = PatchParams::apply(FINALIZER).force();
        let _o = filez_resources_api
            .patch_status(&name, &ps, &new_status)
            .await?;

        recorder
            .publish(Event {
                type_: EventType::Normal,
                reason: "ObjectCreated".into(),
                note: Some(format!("Object Created: `{name}`")),
                action: "CreateObject".into(),
                secondary: None,
            })
            .await?;

        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
    }
    async fn cleanup(&self, ctx: Arc<ControllerContext>) -> Result<Action, FilezError> {
        let full_name = format!(
            "{}-{}",
            self.namespace().unwrap_or_default(),
            self.name_any()
        );
        match self.spec {
            FilezResourceSpec::StorageLocation(_) => {
                StorageLocation::delete(&ctx.storage_location_providers, &ctx.database, &full_name)
                    .await?;
            }
            FilezResourceSpec::MowsApp(_) => {
                MowsApp::delete(&ctx.database, &full_name).await?;
            }
        }

        let recorder = ctx
            .diagnostics
            .read()
            .await
            .recorder(ctx.client.clone(), self);

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

pub async fn get_controller_health() -> Result<(), FilezError> {
    let kube_client = Client::try_default().await?;
    let filez_resource = Api::<FilezResource>::all(kube_client.clone());
    if let Err(e) = filez_resource.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        return Err(FilezError::ControllerKubeError(e));
    }
    Ok(())
}

#[derive(Clone, Default)]
pub struct ControllerState {
    /// Diagnostics populated by the reconciler
    pub diagnostics: Arc<RwLock<Diagnostics>>,
    /// Metrics
    pub metrics: Arc<Metrics>,
}

// Context for our reconciler
#[derive(Clone)]
pub struct ControllerContext {
    /// Kubernetes client
    pub client: Client,
    /// Diagnostics read by the web server
    pub diagnostics: Arc<RwLock<Diagnostics>>,
    /// Prometheus metrics
    pub metrics: Arc<Metrics>,
    pub database: Database,
    pub storage_location_providers: StorageLocationState,
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
            reporter: "filez-resource-controller".into(),
        }
    }
}
impl Diagnostics {
    pub fn recorder(&self, client: Client, resource: &FilezResource) -> Recorder {
        Recorder::new(client, self.reporter.clone(), resource.object_ref(&()))
    }
}

pub async fn run(state: ServerState) -> Result<(), FilezError> {
    let client = Client::try_default().await.map_err(|e| {
        error!("Failed to create Kubernetes client: {e:?}");
        FilezError::ControllerKubeError(e)
    })?;
    let filez_resource = Api::<FilezResource>::all(client.clone());
    if let Err(e) = filez_resource.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
    }

    let config = get_current_config_cloned!(config());

    Ok(
        Controller::new(filez_resource, Config::default().any_semantic())
            .shutdown_on_signal()
            .run(
                reconcile,
                |filez_resource, error, ctx| {
                    error_policy(
                        filez_resource,
                        error,
                        ctx,
                        config.reconcile_interval_seconds,
                    )
                },
                state.to_context(client),
            )
            .filter_map(|x| async move { std::result::Result::ok(x) })
            .for_each(|_| futures::future::ready(()))
            .await,
    )
}

#[instrument(skip(ctx), fields(trace_id))]
async fn reconcile(
    vault_resource: Arc<FilezResource>,
    ctx: Arc<ControllerContext>,
) -> Result<Action, FilezError> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = vault_resource.namespace().unwrap(); // vault resources are namespace scoped
    let vault_resources: Api<FilezResource> = Api::namespaced(ctx.client.clone(), &ns);

    info!(
        "Reconciling Document \"{}\" in {}",
        vault_resource.name_any(),
        ns
    );
    finalizer(&vault_resources, FINALIZER, vault_resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| FilezError::ControllerFinalizerError(Box::new(e)))
}

fn error_policy(
    vault_resource: Arc<FilezResource>,
    error: &FilezError,
    ctx: Arc<ControllerContext>,
    reconcile_interval_seconds: u64,
) -> Action {
    error!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&vault_resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}
