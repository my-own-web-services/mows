//! `/v1/events` — websocket stream of state-change notifications.
//!
//! The supervisor's web UI subscribes here and re-fetches REST data when a
//! relevant event arrives, instead of polling on a 2 s timer. Out-of-band
//! relative to OpenAPI: WebSocket endpoints aren't part of the REST spec
//! (see the design note at the top of `api::mod`).
//!
//! Wire format: one JSON text frame per event, e.g.
//!
//! ```text
//! {"type":"vm_updated","id":"3f4…"}
//! {"type":"agent_deleted","id":"abc…"}
//! ```
//!
//! Errors:
//! - If the broadcast channel lags this connection (slow client), the
//!   forwarder sends `{"type":"resync"}` so the client can re-fetch.
//! - Any WS send failure tears down the connection; the client should
//!   reconnect with backoff.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use futures_util::SinkExt;
use tokio::sync::broadcast::error::RecvError;

use crate::events::SupervisorEvent;
use crate::state::SharedState;

pub fn ws_router() -> Router<SharedState> {
    Router::new().route("/v1/events", get(get_events))
}

async fn get_events(
    State(state): State<SharedState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let receiver = state.events.subscribe();
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = forward(socket, receiver).await {
            tracing::debug!(error = %e, "events ws ended");
        }
    })
}

async fn forward(
    socket: WebSocket,
    mut receiver: tokio::sync::broadcast::Receiver<SupervisorEvent>,
) -> std::io::Result<()> {
    use futures_util::StreamExt;
    let (mut sink, mut stream) = socket.split();

    // Pump client → server in the background so a Close / Ping triggers a
    // clean teardown; the actual events flow server → client.
    let client_drain = tokio::spawn(async move {
        while let Some(msg) = stream.next().await {
            match msg {
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    });

    loop {
        match receiver.recv().await {
            Ok(event) => {
                let payload = match serde_json::to_string(&event) {
                    Ok(s) => s,
                    Err(e) => {
                        tracing::warn!(error = %e, "failed to serialise event");
                        continue;
                    }
                };
                if sink.send(Message::Text(payload.into())).await.is_err() {
                    break;
                }
            }
            Err(RecvError::Lagged(skipped)) => {
                tracing::warn!(skipped, "events subscriber lagged; sending resync");
                let payload = serde_json::to_string(&SupervisorEvent::Resync)
                    .unwrap_or_else(|_| String::from("{\"type\":\"resync\"}"));
                if sink.send(Message::Text(payload.into())).await.is_err() {
                    break;
                }
            }
            Err(RecvError::Closed) => break,
        }
    }

    let _ = sink.close().await;
    client_drain.abort();
    Ok(())
}
