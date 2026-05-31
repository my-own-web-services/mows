use axum::{
    extract::{Path, State},
    Extension, Json,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
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
        audit_log::{AuditEvent, AuditLog},
        channels::{Channel, ChannelId},
    },
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
    utils::get_current_timestamp,
};

#[derive(Deserialize, ToSchema, Debug)]
pub struct UpdateChannelRequest {
    /// New display name. Trimmed; 1-256 characters.
    pub name: Option<String>,
    /// Topic line; `null` clears it, omitted leaves it alone
    /// (serde double-Option pattern — same trick filez Phase 4
    /// uses for UserGroup description).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub topic: Option<Option<String>>,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct UpdateChannelResponse {
    pub channel: Channel,
}

#[utoipa::path(
    put,
    path = "/api/channels/update/{channel_id}",
    description = "Rename a channel or update its topic.",
    params(("channel_id" = Uuid, Path, description = "The channel id")),
    request_body = UpdateChannelRequest,
    responses(
        (status = 200, description = "Channel updated", body = ApiResponse<UpdateChannelResponse>),
        (status = 403, description = "Caller lacks ChannelsUpdate"),
        (status = 404, description = "Channel not found"),
    )
)]
pub async fn update_channel(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
    Json(body): Json<UpdateChannelRequest>,
) -> Result<Json<ApiResponse<UpdateChannelResponse>>, RealtimeError> {
    check_resources_access_control(
        &state.database,
        auth.requesting_user.as_ref(),
        &auth.requesting_user_groups,
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[channel_id]),
        AccessPolicyAction::ChannelsUpdate,
    )
    .await?
    .verify()?;

    let mut connection = state.database.get_connection().await?;
    let channel_id_typed = ChannelId(channel_id);

    // Apply only the fields that were supplied.
    let now = get_current_timestamp();
    if let Some(new_name) = body.name {
        let new_name = new_name.trim().to_string();
        if new_name.is_empty() || new_name.len() > 256 {
            return Err(RealtimeError::BadRequest(
                "channel name must be 1-256 characters".to_string(),
            ));
        }
        diesel::update(schema::channels::table.find(channel_id_typed))
            .set((
                schema::channels::name.eq(new_name),
                schema::channels::modified_time.eq(now),
            ))
            .execute(&mut connection)
            .await?;
    }
    if let Some(new_topic) = body.topic {
        diesel::update(schema::channels::table.find(channel_id_typed))
            .set((
                schema::channels::topic.eq(new_topic),
                schema::channels::modified_time.eq(now),
            ))
            .execute(&mut connection)
            .await?;
    }

    let rows = Channel::get_by_ids(&state.database, &[channel_id_typed]).await?;
    let channel = rows
        .into_iter()
        .next()
        .ok_or_else(|| RealtimeError::NotFound(format!("channel {channel_id}")))?;

    // Audit the update with the post-edit name, so a timeline scan
    // can read the channel's name evolution without joining back to
    // the (mutated) channels row. Actor is the caller — already
    // proven authenticated by the check_access call above.
    if let Some(actor) = auth.requesting_user.as_ref() {
        AuditLog::insert(
            &state.database,
            AuditEvent::ChannelUpdated {
                name: channel.name.clone(),
            },
            Some(&actor.id),
            AccessPolicyResourceType::Channel,
            Some(channel.id.0),
        )
        .await?;
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "channel updated".to_string(),
        data: Some(UpdateChannelResponse { channel }),
    }))
}
