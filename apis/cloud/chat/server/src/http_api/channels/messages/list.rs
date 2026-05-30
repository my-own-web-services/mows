use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::{
    errors::{AuthResultExt, ChatError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            check::check_resources_access_control, AccessPolicyAction,
            AccessPolicyResourceType,
        },
        channels::{messages::ChannelMessage, ChannelId},
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 500;

#[derive(Deserialize, IntoParams, Debug, Default)]
pub struct ListMessagesQuery {
    /// Newest-first cap; clamped to `MAX_LIMIT`. Defaults to 50.
    pub limit: Option<i64>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListMessagesResponse {
    pub messages: Vec<ChannelMessage>,
}

#[utoipa::path(
    get,
    path = "/api/channels/{channel_id}/messages",
    description = "Most-recent-first page of channel messages. Caller must have ChannelsRead on the channel.",
    params(
        ("channel_id" = Uuid, Path, description = "The channel id"),
        ListMessagesQuery,
    ),
    responses(
        (status = 200, description = "Messages", body = ApiResponse<ListMessagesResponse>),
        (status = 403, description = "Caller lacks ChannelsRead"),
    )
)]
pub async fn list_messages(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
    Query(query): Query<ListMessagesQuery>,
) -> Result<Json<ApiResponse<ListMessagesResponse>>, ChatError> {
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

    let limit = query
        .limit
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(1, MAX_LIMIT);
    let messages =
        ChannelMessage::list_recent(&state.database, ChannelId(channel_id), limit).await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} message(s)", messages.len()),
        data: Some(ListMessagesResponse { messages }),
    }))
}
