use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
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
        channels::{Channel, ChannelId},
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct GetChannelResponse {
    pub channel: Channel,
}

#[utoipa::path(
    get,
    path = "/api/channels/get/{channel_id}",
    description = "Read channel metadata.",
    params(("channel_id" = Uuid, Path, description = "The channel id")),
    responses(
        (status = 200, description = "Channel", body = ApiResponse<GetChannelResponse>),
        (status = 403, description = "Caller lacks ChannelsGet"),
        (status = 404, description = "Channel not found"),
    )
)]
pub async fn get_channel(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<ApiResponse<GetChannelResponse>>, RealtimeError> {
    check_resources_access_control(
        &state.database,
        auth.requesting_user.as_ref(),
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[channel_id]),
        AccessPolicyAction::ChannelsGet,
    )
    .await?
    .verify()?;

    let rows = Channel::get_by_ids(&state.database, &[ChannelId(channel_id)]).await?;
    let channel = rows
        .into_iter()
        .next()
        .ok_or_else(|| RealtimeError::NotFound(format!("channel {channel_id}")))?;
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "channel".to_string(),
        data: Some(GetChannelResponse { channel }),
    }))
}
