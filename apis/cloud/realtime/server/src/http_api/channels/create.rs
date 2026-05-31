use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::{AuthResultExt, RealtimeError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            check::check_resources_access_control, AccessPolicyAction,
            AccessPolicyResourceType,
        },
        audit_log::{AuditEvent, AuditLog},
        channels::Channel,
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Deserialize, ToSchema, Debug)]
pub struct CreateChannelRequest {
    pub name: String,
    pub topic: Option<String>,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct CreateChannelResponse {
    pub channel: Channel,
}

#[utoipa::path(
    post,
    path = "/api/channels/create",
    description = "Create a new chat channel owned by the caller.",
    request_body = CreateChannelRequest,
    responses(
        (status = 200, description = "Channel created", body = ApiResponse<CreateChannelResponse>),
        (status = 401, description = "Anonymous request"),
        (status = 403, description = "Caller lacks ChannelsCreate"),
    )
)]
pub async fn create_channel(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(body): Json<CreateChannelRequest>,
) -> Result<Json<ApiResponse<CreateChannelResponse>>, RealtimeError> {
    let user = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    let name = body.name.trim();
    if name.is_empty() || name.len() > 256 {
        return Err(RealtimeError::BadRequest(
            "channel name must be 1-256 characters".to_string(),
        ));
    }

    // Type-level check: the engine looks for "any user → may
    // create *any* channel?" policies. No matching policy =
    // default-permissive (`verify_allow_type_level`) — the chat
    // service treats channel creation as something every logged-in
    // user can do unless an explicit Deny lands. Production
    // hardening would tighten this.
    check_resources_access_control(
        &state.database,
        Some(user),
        &auth.requesting_user_groups,
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        None,
        AccessPolicyAction::ChannelsCreate,
    )
    .await?
    .verify_allow_type_level()?;

    let channel = Channel::new(user.id, name, body.topic.clone())
        .insert(&state.database)
        .await?;

    // Audit the create. The write is outside the create transaction
    // — if it fails, the channel still exists; we surface the error
    // via the standard ?-propagation so the caller knows the audit
    // trail is incomplete. Fire-and-forget would hide a broken
    // audit pipeline, which the Phase-7 admin UI relies on.
    AuditLog::insert(
        &state.database,
        AuditEvent::ChannelCreated {
            name: channel.name.clone(),
        },
        Some(&user.id),
        AccessPolicyResourceType::Channel,
        Some(channel.id.0),
    )
    .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "channel created".to_string(),
        data: Some(CreateChannelResponse { channel }),
    }))
}
