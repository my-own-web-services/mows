use crate::{config::config, state::ServerState};
use chrono::{DateTime, Utc};
use crd::FilezResource;
use errors::{ControllerError, Result};
use futures::StreamExt;
use kube::{
    api::{Api, ListParams},
    runtime::{
        controller::Action,
        events::{Recorder, Reporter},
        finalizer::{finalizer, Event as Finalizer},
        watcher::Config,
        Controller,
    },
    Client, Resource, ResourceExt,
};
use metrics::Metrics;
use mows_common_rust::{get_current_config_cloned, observability::get_trace_id};
use serde::Serialize;
use std::{sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{error, field, info, instrument, warn, Span};

pub mod crd;
pub mod errors;
pub mod metrics;

pub static FINALIZER: &str = "filez.k8s.mows.cloud";

impl FilezResource {
    async fn reconcile(&self, _ctx: Arc<ControllerContext>) -> Result<Action> {
        todo!()
    }
    async fn cleanup(&self, _ctx: Arc<ControllerContext>) -> Result<Action> {
        todo!()
    }
}

#[derive(Clone, Default)]
pub struct ControllerState {
    /// Diagnostics populated by the reconciler
    pub diagnostics: Arc<RwLock<Diagnostics>>,
    /// Metrics
    pub metrics: Arc<Metrics>,
}

impl ControllerState {
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
            client,
            metrics: self.metrics.clone(),
            diagnostics: self.diagnostics.clone(),
        })
    }
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
