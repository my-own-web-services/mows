use axum::{
    extract::{Path, State},
    Extension, Json,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Serialize;
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
        channels::ChannelId,
    },
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, ToSchema, Debug)]
pub struct DeleteChannelResponse {
    pub deleted_id: Uuid,
}

#[utoipa::path(
    delete,
    path = "/api/channels/delete/{channel_id}",
    description = "Delete a channel. CASCADEs every message + every related access_policies row.",
    params(("channel_id" = Uuid, Path, description = "The channel id")),
    responses(
        (status = 200, description = "Channel deleted", body = ApiResponse<DeleteChannelResponse>),
        (status = 403, description = "Caller lacks ChannelsDelete"),
        (status = 404, description = "Channel not found"),
    )
)]
pub async fn delete_channel(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<ApiResponse<DeleteChannelResponse>>, RealtimeError> {
    check_resources_access_control(
        &state.database,
        auth.requesting_user.as_ref(),
        &auth.requesting_user_groups,
        &auth.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[channel_id]),
        AccessPolicyAction::ChannelsDelete,
    )
    .await?
    .verify()?;

    // Drop the channel + every access_policies row that targeted
    // this specific channel in a single transaction so a failure
    // halfway can't leave orphan policies (review A10 / QA-5).
    //
    // The DELETE on channels uses RETURNING to capture the name in
    // the same round-trip — no separate "fetch-before-delete" SELECT
    // that would open a race window where a concurrent rename
    // landed between the read and the write (review R2 / SLOP-5).
    let mut connection = state.database.get_connection().await?;
    let (channel_name, dropped_subject_policies): (String, usize) = {
        use diesel_async::scoped_futures::ScopedFutureExt;
        use diesel_async::AsyncConnection;
        connection
            .transaction::<(String, usize), RealtimeError, _>(|conn| {
                async move {
                    let deleted_name = diesel::delete(
                        schema::channels::table
                            .filter(schema::channels::id.eq(ChannelId(channel_id))),
                    )
                    .returning(schema::channels::name)
                    .get_result::<String>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| {
                        RealtimeError::NotFound(format!("channel {channel_id}"))
                    })?;
                    let dropped = diesel::delete(
                        schema::access_policies::table.filter(
                            schema::access_policies::resource_type
                                .eq(AccessPolicyResourceType::Channel)
                                .and(
                                    schema::access_policies::resource_id
                                        .eq(channel_id),
                                ),
                        ),
                    )
                    .execute(conn)
                    .await?;
                    Ok((deleted_name, dropped))
                }
                .scope_boxed()
            })
            .await?
    };

    if let Some(actor) = auth.requesting_user.as_ref() {
        AuditLog::insert(
            &state.database,
            AuditEvent::ChannelDeleted {
                name: channel_name,
                dropped_subject_policies,
            },
            Some(&actor.id),
            AccessPolicyResourceType::Channel,
            Some(channel_id),
        )
        .await?;
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "channel deleted".to_string(),
        data: Some(DeleteChannelResponse { deleted_id: channel_id }),
    }))
}
