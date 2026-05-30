//! WebSocket subscription endpoint: `/api/channels/{channel_id}/live`.
//!
//! Pre-upgrade flow:
//!   1. Auth middleware has already run; AuthenticationInformation
//!      is in extensions.
//!   2. Handler runs `check(ChannelsRead)` for the channel; deny →
//!      403 (no upgrade).
//!   3. On Allow, axum upgrades the connection. The post-upgrade
//!      loop subscribes to the per-channel broadcast registry and
//!      pumps events to the WS.
//!
//! Single-process broadcast — see `crate::realtime` for the
//! horizontal-scaling trade-off rationale.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::Response,
    Extension,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tokio::sync::broadcast::error::RecvError;
use uuid::Uuid;

use crate::{
    errors::{AuthResultExt, ChatError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            check::check_resources_access_control, AccessPolicyAction,
            AccessPolicyResourceType,
        },
        channels::ChannelId,
    },
    realtime::ChannelEvent,
    state::AppState,
};

pub async fn channel_live(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> Result<Response, ChatError> {
    check_resources_access_control(
        &state.database,
        auth.requesting_user.as_ref(),
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[channel_id]),
        AccessPolicyAction::ChannelsRead,
    )
    .await?
    .verify()?;

    let channel_id_typed = ChannelId(channel_id);
    Ok(ws.on_upgrade(move |socket| pump_subscription(socket, state, channel_id_typed)))
}

async fn pump_subscription(
    socket: WebSocket,
    state: AppState,
    channel_id: ChannelId,
) {
    let (mut writer, mut reader) = socket.split();
    // Subscribe BEFORE sending the ready-signal frame so any
    // events published during the handshake reach us (review A4 /
    // SLOP-3 / QA-1 — replaces the test's hardcoded sleep).
    let mut receiver = state.broadcast.subscribe(channel_id).await;

    // Send a typed ChannelEvent::Ready frame so clients (notably
    // the end_to_end test) can race-freely know the subscription
    // is installed and downstream publishes will be observed.
    let ready_frame = serde_json::to_string(&ChannelEvent::Ready)
        .expect("ChannelEvent::Ready serialises (unit variant, no payload)");
    if writer.send(Message::Text(ready_frame.into())).await.is_err() {
        return;
    }

    // Reader task — closes the connection when the client goes
    // away (recv returns None / Err). We don't process incoming
    // messages from the client in v1; future variants (typing
    // indicators, presence) would consume them here.
    let reader_handle = tokio::spawn(async move {
        while let Some(msg) = reader.next().await {
            match msg {
                Ok(Message::Close(_)) | Err(_) => break,
                Ok(_) => continue,
            }
        }
    });

    loop {
        let event = match receiver.recv().await {
            Ok(e) => e,
            Err(RecvError::Lagged(n)) => {
                // Notify the client + keep going. The receiver is
                // already positioned at the newest available
                // event, so the next recv() succeeds.
                ChannelEvent::Lagged { dropped: n }
            }
            Err(RecvError::Closed) => break,
        };
        let frame = match serde_json::to_string(&event) {
            Ok(s) => s,
            Err(e) => {
                // Should be unreachable — every ChannelEvent
                // variant is composed of serde-friendly types.
                // If it does happen, treat as a 1-event drop:
                // log + tell the client to re-fetch via REST.
                // Silently `continue` would leave the subscriber
                // with a hole they can't detect (review A9 /
                // SLOP-5).
                tracing::error!(
                    error = %e,
                    "ChannelEvent serialise failed — emitting Lagged{{1}}"
                );
                let lagged =
                    serde_json::to_string(&ChannelEvent::Lagged { dropped: 1 })
                        .unwrap_or_else(|_| {
                            r#"{"kind":"lagged","dropped":1}"#.to_string()
                        });
                if writer.send(Message::Text(lagged.into())).await.is_err() {
                    break;
                }
                continue;
            }
        };
        if writer.send(Message::Text(frame.into())).await.is_err() {
            // Client disconnected mid-send; abort the pump.
            break;
        }
    }

    reader_handle.abort();
}
