use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::agent_runtime::AgentRuntimeRegistry;
use crate::config::SupervisorConfig;
use crate::qemu::{PortAllocator, VmRegistry};
use crate::ssh_keys::HostKeyPair;

pub struct AppState {
    pub config: SupervisorConfig,
    pub db: SqlitePool,
    /// Tracks live QEMU `Child` handles per VM id.
    pub vms: RwLock<VmRegistry>,
    /// Tracks live agent SSH/pty processes per agent id.
    pub agent_runtimes: AgentRuntimeRegistry,
    pub port_allocator: PortAllocator,
    pub host_keypair: HostKeyPair,
}

impl AppState {
    pub fn new(
        config: SupervisorConfig,
        db: SqlitePool,
        host_keypair: HostKeyPair,
    ) -> Self {
        let port_allocator = PortAllocator::new(config.port_range.clone());
        Self {
            config,
            db,
            vms: RwLock::new(VmRegistry::default()),
            agent_runtimes: AgentRuntimeRegistry::new(),
            port_allocator,
            host_keypair,
        }
    }
}

pub type SharedState = Arc<AppState>;
