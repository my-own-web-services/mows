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
    let mut connection = state.database.get_connection().await?;
    let rows_deleted = {
        use diesel_async::scoped_futures::ScopedFutureExt;
        use diesel_async::AsyncConnection;
        connection
            .transaction::<i64, RealtimeError, _>(|conn| {
                async move {
                    let n = diesel::delete(
                        schema::channels::table
                            .filter(schema::channels::id.eq(ChannelId(channel_id))),
                    )
                    .execute(conn)
                    .await? as i64;
                    if n == 0 {
                        return Err(RealtimeError::NotFound(format!(
                            "channel {channel_id}"
                        )));
                    }
                    diesel::delete(
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
                    Ok(n)
                }
                .scope_boxed()
            })
            .await?
    };
    let _ = rows_deleted; // count is just used for the assert above

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "channel deleted".to_string(),
        data: Some(DeleteChannelResponse { deleted_id: channel_id }),
    }))
}
