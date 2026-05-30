use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::{
    errors::{AuthResultExt, RealtimeError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            check::check_resources_access_control, AccessPolicyAction,
            AccessPolicyResourceType,
        },
        channels::{
            events::{ChannelEvent, MAX_EVENT_KIND_LEN},
            ChannelId,
        },
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 500;

#[derive(Deserialize, IntoParams, Debug, Default)]
pub struct ListEventsQuery {
    /// Newest-first cap; clamped to `MAX_LIMIT`. Defaults to 50.
    pub limit: Option<i64>,
    /// Optional event-kind filter (e.g. `"chat.message"`,
    /// `"webrtc.offer"`). When omitted, every event tag is
    /// returned interleaved.
    pub event_kind: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListEventsResponse {
    pub events: Vec<ChannelEvent>,
}

#[utoipa::path(
    get,
    path = "/api/channels/{channel_id}/events",
    description = "Most-recent-first page of channel events. Caller must have ChannelsRead on the channel. Optional event_kind filter narrows to one tag.",
    params(
        ("channel_id" = Uuid, Path, description = "The channel id"),
        ListEventsQuery,
    ),
    responses(
        (status = 200, description = "Events", body = ApiResponse<ListEventsResponse>),
        (status = 403, description = "Caller lacks ChannelsRead"),
    )
)]
pub async fn list_events(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
    Query(query): Query<ListEventsQuery>,
) -> Result<Json<ApiResponse<ListEventsResponse>>, RealtimeError> {
    if let Some(kind) = &query.event_kind {
        if kind.is_empty() || kind.len() > MAX_EVENT_KIND_LEN {
            return Err(RealtimeError::BadRequest(format!(
                "event_kind filter must be 1-{MAX_EVENT_KIND_LEN} characters"
            )));
        }
    }

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

    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let events = ChannelEvent::list_recent(
        &state.database,
        ChannelId(channel_id),
        query.event_kind.as_deref(),
        limit,
    )
    .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} event(s)", events.len()),
        data: Some(ListEventsResponse { events }),
    }))
}
