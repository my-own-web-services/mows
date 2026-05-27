//! POST /api/user_groups/{user_group_id}/leave
//!
//! Member self-removes from a group. Idempotent — a non-member
//! returns 200 (security-equivalent: caller is not a member).
//!
//! **Authorization model** (USER_GROUPS.md §6): row-based. The
//! membership row (`user_user_group_members`) IS the consent
//! signal — being a member IS the authorization to leave. The
//! DELETE targets only the (caller, group) membership row; even
//! when the caller is not a member, the DELETE is a no-op and we
//! still return 200 (the desired end state — caller is not a
//! member — holds either way).
//!
//! Owners cannot leave their own group per USER_GROUPS.md §7
//! ("Demoting an owner — cannot happen — only way out is to
//! transfer ownership first") — explicit early-return.

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::user_groups::{UserGroup, UserGroupId},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::Json,
    with_timing,
};
use axum::{
    extract::{Path, State},
    Extension,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/{user_group_id}/leave",
    description = "Leave a user group (caller removes their own membership).",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Left the group (or was already not a member)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 401, description = "Anonymous callers cannot leave",
         body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Caller is the group's owner (must transfer ownership first)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn leave_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let leaving = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot leave groups".to_string())
        })?;

    // Load the group to check the owner guard. The membership-row
    // DELETE itself is the actual authorization (row-based per
    // USER_GROUPS.md §6); this load is only for the owner check.
    let user_group = with_timing!(
        UserGroup::get_one_by_id(&database, &user_group_id).await?,
        "Load target user group",
        timing
    );
    if user_group.owner_id == leaving.id {
        return Err(FilezError::Unauthorized(
            "The owner cannot leave their own group — transfer ownership first \
             (USER_GROUPS.md §7)"
                .to_string(),
        ));
    }

    with_timing!(
        UserGroup::remove_users(&database, &user_group_id, &vec![leaving.id.clone()]).await?,
        "Database operation to remove caller from group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Left user group".to_string(),
        data: None,
    }))
}
