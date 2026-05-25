//! Lightweight in-process event bus for VM / agent state changes.
//!
//! Every mutation site (create, status flip, rename, delete) emits a
//! `SupervisorEvent` on the bus. The `/v1/events` websocket endpoint
//! subscribes and forwards events to connected clients as JSON text frames,
//! letting the web UI react to state changes immediately instead of
//! polling REST endpoints on a 2 s timer.
//!
//! Failures to broadcast are silently dropped: when no client is listening
//! the channel returns `Err(SendError)`, which is fine — there's nothing
//! observable to update.

use serde::Serialize;
use tokio::sync::broadcast;
use utoipa::ToSchema;

/// Capacity of the broadcast channel. A slow subscriber that lags by more
/// than this many events will get a `RecvError::Lagged`; the WS forwarder
/// surfaces that as a `snapshot` hint so the client can re-fetch.
pub const CHANNEL_CAPACITY: usize = 256;

/// State-change notification emitted by mutation sites. Serialised to JSON
/// over the `/v1/events` websocket. The `type` discriminator is
/// snake_case so the wire format reads as `{"type":"vm_updated","id":…}`.
#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SupervisorEvent {
    VmCreated { id: String },
    VmUpdated { id: String },
    VmDeleted { id: String },
    AgentCreated { id: String, vm_id: String },
    AgentUpdated { id: String },
    AgentDeleted { id: String },
    /// Sent by the WS forwarder when the broadcast channel lagged and the
    /// subscriber may have missed events. Clients should treat this as a
    /// hint to re-fetch any data they depend on.
    Resync,
}

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<SupervisorEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<SupervisorEvent> {
        self.sender.subscribe()
    }

    /// Fire-and-forget emit. Returns the number of receivers that got the
    /// message; an empty receiver set is normal (no UI clients connected)
    /// and not an error.
    pub fn emit(&self, event: SupervisorEvent) {
        let _ = self.sender.send(event);
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
