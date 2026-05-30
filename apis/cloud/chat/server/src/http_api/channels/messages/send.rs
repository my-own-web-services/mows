use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
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

const MAX_BODY_BYTES: usize = 16_384;

#[derive(Deserialize, ToSchema, Debug)]
pub struct SendMessageRequest {
    pub body: String,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct SendMessageResponse {
    pub message: ChannelMessage,
}

#[utoipa::path(
    post,
    path = "/api/channels/{channel_id}/messages/send",
    description = "Append a message to the channel. Caller must have ChannelsPost on the channel.",
    params(("channel_id" = Uuid, Path, description = "The channel id")),
    request_body = SendMessageRequest,
    responses(
        (status = 200, description = "Message stored", body = ApiResponse<SendMessageResponse>),
        (status = 400, description = "Body empty / too large"),
        (status = 403, description = "Caller lacks ChannelsPost"),
    )
)]
pub async fn send_message(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
    Json(body): Json<SendMessageRequest>,
) -> Result<Json<ApiResponse<SendMessageResponse>>, ChatError> {
    let author = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| ChatError::Unauthorized("authentication required".to_string()))?;

    let text = body.body;
    if text.is_empty() {
        return Err(ChatError::BadRequest("message body is empty".to_string()));
    }
    if text.len() > MAX_BODY_BYTES {
        return Err(ChatError::BadRequest(format!(
            "message body exceeds {MAX_BODY_BYTES} bytes"
        )));
    }

    check_resources_access_control(
        &state.database,
        Some(author),
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[channel_id]),
        AccessPolicyAction::ChannelsPost,
    )
    .await?
    .verify()?;

    let message =
        ChannelMessage::new(ChannelId(channel_id), author.id, text).insert(&state.database).await?;

    // Broadcast publish AFTER the DB commit so subscribers never
    // see ghost messages. publish() no-ops if no subscribers.
    state
        .broadcast
        .publish(
            message.channel_id,
            crate::realtime::ChannelEvent::Message {
                message: message.clone(),
            },
        )
        .await;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "message sent".to_string(),
        data: Some(SendMessageResponse { message }),
    }))
}
