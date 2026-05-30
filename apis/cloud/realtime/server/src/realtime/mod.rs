//! In-process per-channel broadcast registry.
//!
//! Each channel id gets one `tokio::broadcast::Sender`; receivers
//! are created on first subscribe and dropped when their WS handler
//! exits. Bounded capacity (256 events) drops oldest on overflow —
//! a slow subscriber loses events but the durable `channel_events`
//! log is the source of truth, so the WS client can re-fetch the
//! gap via REST.
//!
//! Single-process scope only. Cross-process fanout (Postgres
//! LISTEN/NOTIFY or Redis pub/sub) is the obvious follow-up; this
//! module's `subscribe` / `publish` signatures are stable enough
//! that the bridge can swap in without touching handlers. See
//! `.plans/chat-service/ARCHITECTURE.md` §"Broadcast registry"
//! for the trade-off rationale.

use std::{collections::HashMap, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, Mutex};
use utoipa::ToSchema;

use crate::models::channels::{events::ChannelEvent, ChannelId};

/// Per-channel event broadcast over WebSocket subscriptions.
/// Mirrors the durable `channel_events` row shape — clients
/// receive the full message exactly as the REST list endpoint
/// would return it.
#[derive(Clone, Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChannelFrame {
    /// One-shot handshake the WS handler sends immediately after
    /// the broadcast subscription is installed. Lets a client
    /// know it can start publishing without racing the
    /// subscribe(). Review A4 / SLOP-3 / QA-1.
    Ready,
    /// A new message landed in the channel.
    Event { event: ChannelEvent },
    /// The registry dropped events for this subscriber because the
    /// receiver fell behind. The client should re-fetch via REST
    /// to fill the gap. Emitted by the WS handler, not by
    /// publishers — kept here so all event variants share one type.
    Lagged { dropped: u64 },
}

const CHANNEL_CAPACITY: usize = 256;

/// Thread-safe per-channel sender map. Cloned into `AppState`.
#[derive(Clone, Debug, Default)]
pub struct ChannelBroadcastRegistry {
    inner: Arc<Mutex<HashMap<ChannelId, broadcast::Sender<ChannelFrame>>>>,
}

impl ChannelBroadcastRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Return a receiver for the given channel. Creates the sender
    /// lazily on first call.
    pub async fn subscribe(&self, channel_id: ChannelId) -> broadcast::Receiver<ChannelFrame> {
        let mut guard = self.inner.lock().await;
        let sender = guard
            .entry(channel_id)
            .or_insert_with(|| broadcast::channel(CHANNEL_CAPACITY).0);
        sender.subscribe()
    }

    /// Fan an event out to every subscriber. No-op (Ok) when no
    /// subscribers exist — the durable `channel_events` write
    /// happened before this call, so missing the broadcast just
    /// means no one was listening.
    pub async fn publish(&self, channel_id: ChannelId, event: ChannelFrame) {
        let guard = self.inner.lock().await;
        if let Some(sender) = guard.get(&channel_id) {
            // `send` only fails when there are zero active
            // receivers — fine, the message is durably stored.
            let _ = sender.send(event);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{channels::events::ChannelEventId, users::UserId};

    fn fake_event(channel_id: ChannelId) -> ChannelEvent {
        ChannelEvent {
            id: ChannelEventId::new(),
            channel_id,
            author_id: UserId::new(),
            event_kind: Some("test.fake".to_string()),
            payload: serde_json::json!({"body": "hello"}),
            sent_at: crate::utils::get_current_timestamp(),
        }
    }

    #[tokio::test]
    async fn publish_with_no_subscribers_is_noop() {
        let reg = ChannelBroadcastRegistry::new();
        let ch = ChannelId::new();
        reg.publish(ch, ChannelFrame::Event { event: fake_event(ch) })
            .await;
        // No panic, no error — publish silently no-ops when nobody
        // is listening. The durable row in channel_events is the
        // source of truth.
    }

    #[tokio::test]
    async fn subscriber_receives_subsequent_publish() {
        let reg = ChannelBroadcastRegistry::new();
        let ch = ChannelId::new();
        let mut rx = reg.subscribe(ch).await;
        let msg = fake_event(ch);
        let expected_id = msg.id;
        reg.publish(ch, ChannelFrame::Event { event: msg }).await;
        let received = rx.recv().await.expect("event delivered");
        match received {
            ChannelFrame::Event { event } => assert_eq!(event.id, expected_id),
            other => panic!("expected Event, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn two_subscribers_both_receive() {
        let reg = ChannelBroadcastRegistry::new();
        let ch = ChannelId::new();
        let mut rx1 = reg.subscribe(ch).await;
        let mut rx2 = reg.subscribe(ch).await;
        reg.publish(ch, ChannelFrame::Event { event: fake_event(ch) })
            .await;
        let _ = rx1.recv().await.expect("rx1");
        let _ = rx2.recv().await.expect("rx2");
    }
}
