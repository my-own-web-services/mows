use chrono::{DateTime, Utc};
use crd::{VerkehrResource, VerkehrResourceSpec, VerkehrResourceStatus};
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
use tracing::{debug, error, field, info, instrument, warn, Span};

use crate::{
    config::{config, routing_config::RoutingConfig},
    errors::{get_error_type, VerkehrError},
    state::VerkehrState,
};

pub mod crd;
pub mod metrics;

pub static FINALIZER: &str = "verkehr.k8s.mows.cloud";

#[instrument(skip(ctx), level = "trace")]
async fn inner_reconcile(
    resource: &VerkehrResource,
    ctx: &ControllerContext,
    name: &str,
    namespace: &str,
) -> Result<(), VerkehrError> {
    let full_name = format!("{}-{}", namespace, name);
    debug!("Reconcile resource: {}", full_name);
    match &resource.spec {
        VerkehrResourceSpec::IngressRouteHttp(ingress_route) => {
            info!("Applying IngressRouteHttp configuration for {}", full_name);

            // Convert the IngressRouteHttp to a RoutingConfig
            let new_routing_config = ingress_route
                .to_routing_config(name, namespace)
                .map_err(|e| VerkehrError::ControllerConfigConversionError(e))?;

            // Apply the routing config to the state
            let mut routing_config = ctx.routing_config.write().await;
            routing_config.merge(new_routing_config);

            info!(
                "Successfully applied IngressRouteHttp configuration for {}",
                full_name
            );
            debug!(config = ?*routing_config, "Updated routing config");
        }
    }
    Ok(())
}

impl VerkehrResource {
    #[instrument(skip(ctx), level = "trace")]
    async fn reconcile(&self, ctx: Arc<ControllerContext>) -> Result<Action, VerkehrError> {
        debug!("Starting reconcile for VerkehrResource");
        let kube_client = ctx.client.clone();

        let config = get_current_config_cloned!(config());
        let verkehr_resources_api: Api<VerkehrResource> =
            Api::namespaced(kube_client.clone(), &self.namespace().unwrap_or_default());
        let name = self.metadata.name.clone().ok_or_else(|| {
            VerkehrError::ControllerMissingResourceName(
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
                "apiVersion": "verkehr.k8s.mows.cloud/v1",
                "kind": "VerkehrResource",
                "status": VerkehrResourceStatus {
                    created: false
                }
            }));

            let ps = PatchParams::apply(FINALIZER).force();
            let _o = verkehr_resources_api
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
              "apiVersion": "verkehr.k8s.mows.cloud/v1",
              "kind": "VerkehrResource",
              "status": VerkehrResourceStatus {
                created: true
            }
        }));

        let ps = PatchParams::apply(FINALIZER).force();
        let _o = verkehr_resources_api
            .patch_status(&name, &ps, &new_status)
            .await?;

        recorder
            .publish(Event {
                type_: EventType::Normal,
                reason: "ResourceCreated".into(),
                note: Some(format!("Resource created: `{name}`")),
                action: "CreateObject".into(),
                secondary: None,
            })
            .await?;

        Ok(Action::requeue(Duration::from_secs(
            config.reconcile_interval_seconds,
        )))
    }

    #[instrument(skip(ctx), level = "trace")]
    async fn cleanup(&self, ctx: Arc<ControllerContext>) -> Result<Action, VerkehrError> {
        let name = self.name_any();
        let namespace = self.namespace().unwrap_or_default();
        let full_name = format!("{}-{}", namespace, name);

        info!("Cleaning up VerkehrResource: {}", full_name);

        match &self.spec {
            VerkehrResourceSpec::IngressRouteHttp(_ingress_route) => {
                // Remove routers and services that were created by this resource
                let mut routing_config = ctx.routing_config.write().await;

                if let Some(http_config) = &mut routing_config.http {
                    let prefix = format!("{}-{}-", namespace, name);

                    // Remove routers created by this resource
                    if let Some(routers) = &mut http_config.routers {
                        routers.retain(|router_name, _| !router_name.starts_with(&prefix));
                        info!(
                            "Removed routers with prefix '{}' from routing config",
                            prefix
                        );
                    }

                    // Remove services created by this resource
                    if let Some(services) = &mut http_config.services {
                        services.retain(|service_name, _| !service_name.starts_with(&prefix));
                        info!(
                            "Removed services with prefix '{}' from routing config",
                            prefix
                        );
                    }
                }

                info!(
                    "Successfully cleaned up IngressRouteHttp configuration for {}",
                    full_name
                );
                debug!(config = ?*routing_config, "Updated routing config after cleanup");
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

#[derive(Serialize, Deserialize, Clone, Debug)]
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
pub async fn get_controller_health() -> Result<ControllerHealthDetails, VerkehrError> {
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
    let verkehr_resource = Api::<VerkehrResource>::all(kube_client.clone());
    if let Err(e) = verkehr_resource.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        details.crd_error = Some(e.to_string());
        return Ok(details);
    }
    details.crd_installed = true;

    Ok(details)
}

pub async fn get_controller_health_with_state(
    controller_state: &crate::kubernetes_controller::ControllerState,
) -> Result<ControllerHealthDetails, VerkehrError> {
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
    /// Routing configuration
    pub routing_config: Arc<RwLock<RoutingConfig>>,
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
            reporter: "verkehr-resource-controller".into(),
        }
    }
}
impl Diagnostics {
    pub fn recorder(&self, client: Client, resource: &VerkehrResource) -> Recorder {
        Recorder::new(client, self.reporter.clone(), resource.object_ref(&()))
    }
}

#[instrument(level = "trace")]
pub async fn run_controller(state: VerkehrState) -> Result<(), VerkehrError> {
    // Try to create Kubernetes client - this will fail if not in a k8s cluster
    let client = match Client::try_default().await {
        Ok(client) => {
            info!("Kubernetes client created successfully");
            client
        }
        Err(e) => {
            // Check if we're likely not in a Kubernetes cluster
            if e.to_string().contains("KUBECONFIG")
                || e.to_string().contains("serviceaccount")
                || e.to_string().contains("No such file")
                || e.to_string().contains("configuration")
            {
                warn!(
                    "Could not connect to Kubernetes cluster. \
                    This is normal if not running inside Kubernetes. \
                    Error: {e:?}"
                );
            } else {
                error!("Failed to create Kubernetes client: {e:?}");
            }
            return Err(VerkehrError::ControllerKubeError(e));
        }
    };

    let verkehr_resource = Api::<VerkehrResource>::all(client.clone());

    // Check if CRD is installed and list existing resources
    match verkehr_resource.list(&ListParams::default()).await {
        Ok(list) => {
            info!(
                "CRD is installed. Found {} existing VerkehrResource(s)",
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
        "Starting Verkehr Resource Controller with reconcile interval of {} seconds",
        config.reconcile_interval_seconds
    );

    let controller = Controller::new(verkehr_resource.clone(), Config::default().any_semantic())
        .shutdown_on_signal();

    info!("Controller configured, starting reconciliation loop...");

    Ok(controller
        .run(
            reconcile,
            |verkehr_resource, error, ctx| {
                error_policy(
                    verkehr_resource,
                    error,
                    ctx,
                    config.reconcile_interval_seconds,
                )
            },
            state.to_context(client),
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

#[instrument(skip(ctx), fields(trace_id))]
async fn reconcile(
    resource: Arc<VerkehrResource>,
    ctx: Arc<ControllerContext>,
) -> Result<Action, VerkehrError> {
    let trace_id = get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = resource.namespace().unwrap();
    let resources: Api<VerkehrResource> = Api::namespaced(ctx.client.clone(), &ns);

    info!("Reconciling resource \"{}\" in {}", resource.name_any(), ns);
    finalizer(&resources, FINALIZER, resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| VerkehrError::ControllerFinalizerError(Box::new(e)))
}

fn error_policy(
    resource: Arc<VerkehrResource>,
    error: &VerkehrError,
    ctx: Arc<ControllerContext>,
    reconcile_interval_seconds: u64,
) -> Action {
    error!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}
