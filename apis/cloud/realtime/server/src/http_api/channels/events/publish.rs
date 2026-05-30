use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::{AuthResultExt, RealtimeError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            check::check_resources_access_control, AccessPolicyAction,
            AccessPolicyResourceType,
        },
        channels::{events::ChannelEvent, ChannelId},
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

/// 64 KB cap on payload size. Generous enough for chat messages,
/// SDP/ICE blobs, and most sensor / build / presence payloads;
/// tight enough that no single publish can exhaust the broadcast
/// channel's 256-event buffer with one massive event.
const MAX_PAYLOAD_BYTES: usize = 64 * 1024;

/// Tag length cap. Event-kind tags are typically short
/// (`"chat.message"`, `"webrtc.offer"`); 64 chars covers every
/// realistic case without inviting abuse.
const MAX_EVENT_KIND_LEN: usize = 64;

#[derive(Deserialize, ToSchema, Debug)]
pub struct PublishEventRequest {
    /// Optional caller-supplied tag (`"chat.message"`,
    /// `"webrtc.offer"`, `"presence.heartbeat"`, …). When
    /// `Some`, subscribers can filter the stream cheaply
    /// server-side. Max 64 chars.
    #[serde(default)]
    pub event_kind: Option<String>,
    /// Opaque JSON payload. Stored + replayed verbatim. Max 64 KB.
    #[schema(value_type = serde_json::Value)]
    pub payload: JsonValue,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct PublishEventResponse {
    pub event: ChannelEvent,
}

#[utoipa::path(
    post,
    path = "/api/channels/{channel_id}/events/publish",
    description = "Publish an event to the channel. Caller must have ChannelsPublish on the channel. The payload is opaque JSON — chat apps set event_kind='chat.message', WebRTC apps 'webrtc.offer' etc.",
    params(("channel_id" = Uuid, Path, description = "The channel id")),
    request_body = PublishEventRequest,
    responses(
        (status = 200, description = "Event stored + broadcast", body = ApiResponse<PublishEventResponse>),
        (status = 400, description = "Payload empty / too large / event_kind too long"),
        (status = 403, description = "Caller lacks ChannelsPublish"),
    )
)]
pub async fn publish_event(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
    Json(body): Json<PublishEventRequest>,
) -> Result<Json<ApiResponse<PublishEventResponse>>, RealtimeError> {
    let author = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    if let Some(kind) = &body.event_kind {
        if kind.is_empty() || kind.len() > MAX_EVENT_KIND_LEN {
            return Err(RealtimeError::BadRequest(format!(
                "event_kind must be 1-{MAX_EVENT_KIND_LEN} characters when present"
            )));
        }
    }

    // Cheap upfront size cap. The deserialised Value already
    // tracks the byte length implicitly via its variants; we use
    // `serde_json::to_writer` against a counting sink so the
    // size check doesn't allocate a redundant Vec the way
    // `to_vec().len()` did (review B9 / TECH-1).
    let payload_size = approx_json_size(&body.payload);
    if payload_size > MAX_PAYLOAD_BYTES {
        return Err(RealtimeError::BadRequest(format!(
            "payload exceeds {MAX_PAYLOAD_BYTES} bytes"
        )));
    }
    if body.payload.is_null() {
        // `null` is a valid JSON value but useless as an event
        // body; reject so the caller notices the empty publish.
        // Empty object / array stay valid (a presence ping might
        // be `{}`).
        return Err(RealtimeError::BadRequest(
            "payload must not be JSON null".to_string(),
        ));
    }

    check_resources_access_control(
        &state.database,
        Some(author),
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[channel_id]),
        AccessPolicyAction::ChannelsPublish,
    )
    .await?
    .verify()?;

    let event = ChannelEvent::new(
        ChannelId(channel_id),
        author.id,
        body.event_kind,
        body.payload,
    )
    .insert(&state.database)
    .await?;

    // Broadcast publish AFTER the DB commit so subscribers never
    // see ghost events. publish() no-ops if no subscribers.
    state
        .broadcast
        .publish(
            event.channel_id,
            crate::realtime::ChannelFrame::Event { event: event.clone() },
        )
        .await;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "event published".to_string(),
        data: Some(PublishEventResponse { event }),
    }))
}

/// Counting-writer JSON sink: serialises to a `usize` counter
/// instead of a `Vec<u8>`, so the size check doesn't allocate.
/// Used in lieu of `serde_json::to_vec(&v).len()` (review B9).
fn approx_json_size(v: &serde_json::Value) -> usize {
    struct Counter(usize);
    impl std::io::Write for Counter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0 += buf.len();
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut counter = Counter(0);
    // Errors here are unreachable for `Value` (no IO failures from
    // a memory counter); if they happen the counter just stays at
    // its last value, which is a fail-open in the conservative
    // direction (returns "smaller than reality" → caller might
    // accept a slightly-too-big payload; axum's body cap is the
    // real backstop).
    let _ = serde_json::to_writer(&mut counter, v);
    counter.0
}
