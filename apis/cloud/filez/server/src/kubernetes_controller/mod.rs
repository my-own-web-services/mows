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
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{debug, error, field, info, instrument, Span};
use utoipa::ToSchema;

pub mod crd;
pub mod metrics;

pub static FINALIZER: &str = "filez.k8s.mows.cloud";

#[instrument(skip(controller_context), level = "trace")]
async fn inner_reconcile(
    resource: &FilezResource,
    controller_context: &ControllerContext,
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
                SecretReadableByFilezController::fetch_map(&controller_context.client, namespace)
                    .await?;
            debug!("Fetched secrets for resource: {}", full_name);
            debug!(
                "Creating or updating StorageLocation for resource: {} with config: {:?}",
                full_name, incoming_provider_config
            );

            StorageLocation::create_or_update(
                &controller_context.storage_location_providers,
                &controller_context.database,
                &full_name,
                filez_secrets,
                &incoming_provider_config,
            )
            .await?;
        }
        FilezResourceSpec::MowsApp(incoming_app) => {
            MowsApp::create_or_update(&controller_context.database, incoming_app, &full_name)
                .await?;
        }
    }
    Ok(())
}

impl FilezResource {
    #[instrument(skip(controller_context), level = "trace")]
    async fn reconcile(
        &self,
        controller_context: Arc<ControllerContext>,
    ) -> Result<Action, FilezError> {
        debug!("Starting reconcile for FilezResource");
        let kube_client = controller_context.client.clone();

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

        let recorder = controller_context
            .diagnostics
            .read()
            .await
            .recorder(kube_client.clone(), self);

        if let Err(e) = inner_reconcile(self, &controller_context, &name, &namespace).await {
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

            let mut reason = get_error_type(&e);
            reason.truncate(128);
            let mut note = e.to_string();
            note.truncate(1024);

            recorder
                .publish(Event {
                    type_: EventType::Warning,
                    reason,
                    note: Some(note),
                    action: "CreateFilezResource".into(),
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
                reason: "ResourceCreated".into(),
                note: Some(format!("Resource created: `{name}`")),
                action: "CreateFilezResource".into(),
                secondary: None,
            })
            .await?;

        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
    }

    #[instrument(skip(controller_context), level = "trace")]
    async fn cleanup(
        &self,
        controller_context: Arc<ControllerContext>,
    ) -> Result<Action, FilezError> {
        let full_name = format!(
            "{}-{}",
            self.namespace().unwrap_or_default(),
            self.name_any()
        );
        match self.spec {
            FilezResourceSpec::StorageLocation(_) => {
                StorageLocation::delete(
                    &controller_context.storage_location_providers,
                    &controller_context.database,
                    &full_name,
                )
                .await?;
            }
            FilezResourceSpec::MowsApp(_) => {
                MowsApp::delete(&controller_context.database, &full_name).await?;
            }
        }

        let recorder = controller_context
            .diagnostics
            .read()
            .await
            .recorder(controller_context.client.clone(), self);

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

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ControllerHealthDetails {
    pub kubernetes_reachable: bool,
    pub kubernetes_error: Option<String>,
    pub crd_installed: bool,
    pub crd_error: Option<String>,
    pub reconcile_loop_running: bool,
    pub last_reconcile_event: Option<DateTime<Utc>>,
    pub reconcile_stale: bool,
}

#[tracing::instrument(level = "trace")]
pub async fn get_controller_health() -> Result<ControllerHealthDetails, FilezError> {
    let mut details = ControllerHealthDetails {
        kubernetes_reachable: false,
        kubernetes_error: None,
        crd_installed: false,
        crd_error: None,
        reconcile_loop_running: false,
        last_reconcile_event: None,
        reconcile_stale: false,
    };

    // Check 1: Is Kubernetes reachable at all?
    let kube_client = match Client::try_default().await {
        Ok(client) => {
            details.kubernetes_reachable = true;
            client
        }
        Err(e) => {
            error!("Kubernetes is not reachable: {e:?}");
            details.kubernetes_error = Some(e.to_string());
            return Ok(details);
        }
    };

    // Check 2: Is the CRD installed and queryable?
    let filez_resource = Api::<FilezResource>::all(kube_client.clone());
    if let Err(e) = filez_resource.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        details.crd_error = Some(e.to_string());
        return Ok(details);
    }
    details.crd_installed = true;

    Ok(details)
}

pub async fn get_controller_health_with_state(
    controller_state: &ControllerState,
) -> Result<ControllerHealthDetails, FilezError> {
    let mut details = get_controller_health().await?;

    // Check 3: Is the controller running the reconcile loop?
    // We check if there has been a reconcile event recently
    let diagnostics = controller_state.diagnostics.read().await;
    let last_event = diagnostics.last_event;
    details.last_reconcile_event = Some(last_event);

    let now = Utc::now();
    let time_since_last_event = now.signed_duration_since(last_event);

    // Consider the reconcile loop stale if no event in the last 5 minutes
    const STALE_THRESHOLD_MINUTES: i64 = 5;
    details.reconcile_stale = time_since_last_event.num_minutes() > STALE_THRESHOLD_MINUTES;

    // Reconcile loop is considered running if we've had an event recently
    details.reconcile_loop_running = !details.reconcile_stale;

    Ok(details)
}

#[derive(Clone, Default, Debug)]
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
#[derive(Clone, Serialize, Debug)]
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

#[instrument(level = "trace")]
pub async fn run_controller(shared_state: ServerState) -> Result<(), FilezError> {
    let client = Client::try_default().await.map_err(|e| {
        error!("Failed to create Kubernetes client: {e:?}");
        FilezError::ControllerKubeError(e)
    })?;

    info!("Kubernetes client created successfully");

    let filez_resource = Api::<FilezResource>::all(client.clone());

    // Check if CRD is installed and list existing resources
    match filez_resource.list(&ListParams::default()).await {
        Ok(list) => {
            info!(
                "CRD is installed. Found {} existing FilezResource(s)",
                list.items.len()
            );
            for resource in &list.items {
                info!(
                    "  - {}/{}",
                    resource
                        .namespace()
                        .unwrap_or_else(|| "unknown".to_string()),
                    resource.name_any()
                );
            }
        }
        Err(e) => {
            error!("CRD is not queryable; {e:?}. Is the CRD installed?");
            info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
        }
    }

    let config = get_current_config_cloned!(config());

    info!(
        "Starting Filez Resource Controller with reconcile interval of {} seconds",
        config.reconcile_interval_seconds
    );

    let controller = Controller::new(filez_resource.clone(), Config::default().any_semantic())
        .shutdown_on_signal();

    info!("Controller configured, starting reconciliation loop...");

    Ok(controller
        .run(
            reconcile,
            |filez_resource, error, controller_context| {
                error_policy(
                    filez_resource,
                    error,
                    controller_context,
                    config.reconcile_interval_seconds,
                )
            },
            shared_state.to_context(client),
        )
        .filter_map(|x| async move {
            match &x {
                Ok(_) => info!("Reconciliation completed successfully"),
                Err(e) => error!("Reconciliation error: {:?}", e),
            }
            std::result::Result::ok(x)
        })
        .for_each(|_| futures::future::ready(()))
        .await)
}

#[instrument(skip(controller_context), fields(trace_id))]
async fn reconcile(
    resource: Arc<FilezResource>,
    controller_context: Arc<ControllerContext>,
) -> Result<Action, FilezError> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = controller_context
        .metrics
        .reconcile
        .count_and_measure(&trace_id);
    controller_context.diagnostics.write().await.last_event = Utc::now();
    let ns = resource.namespace().unwrap();
    let resources: Api<FilezResource> = Api::namespaced(controller_context.client.clone(), &ns);

    info!("Reconciling resource \"{}\" in {}", resource.name_any(), ns);
    finalizer(&resources, FINALIZER, resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(controller_context.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(controller_context.clone()).await,
        }
    })
    .await
    .map_err(|e| FilezError::ControllerFinalizerError(Box::new(e)))
}

fn error_policy(
    resource: Arc<FilezResource>,
    error: &FilezError,
    controller_context: Arc<ControllerContext>,
    reconcile_interval_seconds: u64,
) -> Action {
    error!("reconcile failed: {:?}", error);
    controller_context
        .metrics
        .reconcile
        .set_failure(&resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}
