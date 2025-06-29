use crate::{
    apps::FilezApp,
    config::config,
    state::ServerState,
    storage::state::{StorageLocationsState, StorageProvider},
};
use chrono::{DateTime, Utc};
use crd::{FilezResource, FilezResourceSpec, FilezResourceStatus, SecretReadableByFilezController};
use errors::{get_error_type, ControllerError, Result};
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
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{error, field, info, instrument, warn, Span};

pub mod crd;
pub mod errors;
pub mod metrics;

pub static FINALIZER: &str = "filez.k8s.mows.cloud";

async fn inner_reconcile(
    resource: &FilezResource,
    ctx: &ControllerContext,
    name: &str,
    namespace: &str,
) -> Result<(), ControllerError> {
    let full_name = format!("{}-{}", namespace, name);
    match resource.spec {
        FilezResourceSpec::StorageLocation(ref incoming_provider_config) => {
            let locations_config = ctx.storage_locations.locations.read().await.clone();

            let filez_secrets =
                SecretReadableByFilezController::fetch_map(&ctx.client, namespace).await?;

            match locations_config.get(&full_name) {
                Some((_, location_config)) => {
                    // Update existing storage location if the config has changed
                    if location_config != incoming_provider_config {
                        let provider =
                            StorageProvider::initialize(incoming_provider_config, &filez_secrets)
                                .await?;
                        let mut locations = ctx.storage_locations.locations.write().await;
                        locations.insert(full_name, (provider, incoming_provider_config.clone()));
                    }
                }
                None => {
                    // Insert new storage location
                    let provider =
                        StorageProvider::initialize(incoming_provider_config, &filez_secrets)
                            .await?;
                    ctx.storage_locations
                        .locations
                        .write()
                        .await
                        .insert(full_name, (provider, incoming_provider_config.clone()));
                }
            }
        }
        FilezResourceSpec::FilezApp(ref incoming_app) => {
            // insert or update the app in the state
            let mut apps = ctx.apps.write().await;
            if let Some(existing_app) = apps.get_mut(&full_name) {
                // Update existing app
                *existing_app = incoming_app.clone();
            } else {
                // Insert new app
                apps.insert(full_name, incoming_app.clone());
            }
        }
    }
    Ok(())
}

impl FilezResource {
    async fn reconcile(&self, ctx: Arc<ControllerContext>) -> Result<Action> {
        let kube_client = ctx.client.clone();

        let config = get_current_config_cloned!(config());
        let filez_resources_api: Api<FilezResource> =
            Api::namespaced(kube_client.clone(), &self.namespace().unwrap_or_default());
        let name = self.metadata.name.clone().ok_or_else(|| {
            ControllerError::MissingResourceName(self.metadata.name.clone().unwrap_or_default())
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
    async fn cleanup(&self, ctx: Arc<ControllerContext>) -> Result<Action> {
        match self.spec {
            FilezResourceSpec::StorageLocation(_) => {
                ctx.storage_locations
                    .locations
                    .write()
                    .await
                    .remove(&self.name_any());
            }
            FilezResourceSpec::FilezApp(_) => {
                ctx.apps.write().await.remove(&self.name_any());
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

    /// Apps state
    pub apps: Arc<RwLock<HashMap<String, FilezApp>>>,

    pub storage_locations: StorageLocationsState,
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

pub async fn sync_state_with_kubernetes(state: &ServerState) -> Result<()> {
    let client = Client::try_default().await.map_err(|e| {
        error!("Failed to create Kubernetes client: {e:?}");
        ControllerError::KubeError(e)
    })?;
    let apps = Api::<FilezResource>::all(client.clone());
    let list_params = ListParams::default();
    let resources = apps.list(&list_params).await.map_err(|e| {
        error!("Failed to list Filez resources: {e:?}");
        ControllerError::KubeError(e)
    })?;

    for resource in resources {
        let name = resource
            .metadata
            .name
            .clone()
            .ok_or(ControllerError::MissingResourceName(
                resource.metadata.name.clone().unwrap_or_default(),
            ))?;

        let namespace = resource.metadata.namespace.clone().unwrap_or_default();

        let filez_secrets = SecretReadableByFilezController::fetch_map(&client, &namespace).await?;

        let full_name = format!("{}-{}", namespace, name);

        match resource.spec {
            FilezResourceSpec::StorageLocation(provider_config) => {
                let provider =
                    match StorageProvider::initialize(&provider_config, &filez_secrets).await {
                        Ok(provider) => provider,
                        Err(e) => {
                            error!("Failed to initialize storage provider: {e:?}");
                            continue;
                        }
                    };

                state
                    .storage_locations
                    .locations
                    .write()
                    .await
                    .insert(full_name, (provider, provider_config));
            }
            FilezResourceSpec::FilezApp(app) => {
                state.apps.write().await.insert(full_name, app);
            }
        }
    }

    Ok(())
}

pub async fn run(state: ServerState) -> Result<()> {
    let client = Client::try_default().await.map_err(|e| {
        error!("Failed to create Kubernetes client: {e:?}");
        ControllerError::KubeError(e)
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
) -> Result<Action> {
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
    .map_err(|e| ControllerError::FinalizerError(Box::new(e)))
}

fn error_policy(
    vault_resource: Arc<FilezResource>,
    error: &ControllerError,
    ctx: Arc<ControllerContext>,
    reconcile_interval_seconds: u64,
) -> Action {
    warn!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&vault_resource, error);

    Action::requeue(Duration::from_secs(reconcile_interval_seconds))
}
