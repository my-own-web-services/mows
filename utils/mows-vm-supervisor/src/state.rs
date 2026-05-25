use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::agent_runtime::AgentRuntimeRegistry;
use crate::config::SupervisorConfig;
use crate::events::EventBus;
use crate::qemu::{PortAllocator, VmRegistry};

pub struct AppState {
    pub config: SupervisorConfig,
    pub db: SqlitePool,
    /// Tracks live QEMU `Child` handles per VM id.
    pub vms: RwLock<VmRegistry>,
    /// Tracks live agent SSH/pty processes per agent id.
    pub agent_runtimes: AgentRuntimeRegistry,
    pub port_allocator: PortAllocator,
    /// In-process state-change broadcast. Mutation sites emit; the
    /// `/v1/events` websocket forwards to connected UI clients.
    pub events: EventBus,
}

impl AppState {
    pub fn new(config: SupervisorConfig, db: SqlitePool) -> Self {
        let port_allocator = PortAllocator::new(config.port_range.clone());
        Self {
            config,
            db,
            vms: RwLock::new(VmRegistry::default()),
            agent_runtimes: AgentRuntimeRegistry::new(),
            port_allocator,
            events: EventBus::new(),
        }
    }

    /// Construct with an already-reserved set of ports. Used at startup to
    /// recover allocator state from the `vms` table so the supervisor never
    /// hands out a port still bound by a VM that survived the restart.
    pub fn with_port_reservations(
        config: SupervisorConfig,
        db: SqlitePool,
        reservations: impl IntoIterator<Item = u16>,
    ) -> Self {
        let port_allocator =
            PortAllocator::with_reservations(config.port_range.clone(), reservations);
        Self {
            config,
            db,
            vms: RwLock::new(VmRegistry::default()),
            agent_runtimes: AgentRuntimeRegistry::new(),
            port_allocator,
            events: EventBus::new(),
        }
    }
}

pub type SharedState = Arc<AppState>;
