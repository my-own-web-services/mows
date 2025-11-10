use std::sync::Arc;

use kube::Client;
use tokio::sync::RwLock;

use crate::{
    config::routing_config::RoutingConfig,
    kubernetes_controller::{ControllerContext, ControllerState, Diagnostics},
};

#[derive(Clone, Debug)]
pub struct VerkehrState {
    pub routing_config: Arc<RwLock<RoutingConfig>>,
    pub controller_state: ControllerState,
}

impl VerkehrState {
    pub async fn new() -> anyhow::Result<Self> {
        Ok(Self {
            routing_config: Arc::new(RwLock::new(RoutingConfig::default())),
            controller_state: ControllerState::default(),
        })
    }

    pub fn metrics(&self) -> String {
        let mut buffer = String::new();
        let registry = &*self.controller_state.metrics.registry;
        prometheus_client::encoding::text::encode(&mut buffer, registry).unwrap();
        buffer
    }

    /// State getter
    pub async fn diagnostics(&self) -> Diagnostics {
        self.controller_state.diagnostics.read().await.clone()
    }

    // Create a Controller Context that can update State
    pub fn to_context(&self, client: Client) -> Arc<ControllerContext> {
        Arc::new(ControllerContext {
            client,
            metrics: self.controller_state.metrics.clone(),
            diagnostics: self.controller_state.diagnostics.clone(),
            routing_config: self.routing_config.clone(),
        })
    }
}
