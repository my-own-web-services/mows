//! POST /api/user_groups/{user_group_id}/invitations/decline
//!
//! Invitee declines their pending invitation. Idempotent — a
//! missing invitation returns 200, since the security-relevant
//! outcome is the same: no membership exists.
//!
//! **Authorization model** (USER_GROUPS.md §6): row-based, mirror
//! of `accept`. The DELETE targets only the (caller, group)
//! invitation row — even if a row exists for a DIFFERENT caller on
//! this group, this caller's DELETE is a no-op. No
//! `AccessPolicy::check(UserGroupsRespondToInvite)` for the same
//! reason as accept (see accept.rs module docstring).

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        user_groups::UserGroupId,
        user_user_group_invitations::UserUserGroupInvitation,
    },
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
    path = "/api/user_groups/{user_group_id}/invitations/decline",
    description = "Decline the caller's pending invitation (idempotent).",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Invitation declined (or was already gone)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 401, description = "Anonymous callers cannot decline",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn decline_invitation(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let invitee = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot decline invitations".to_string())
        })?;

    with_timing!(
        UserUserGroupInvitation::delete_one(&database, &invitee.id, &user_group_id).await?,
        "Database operation to delete invitation",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Invitation declined".to_string(),
        data: None,
    }))
}
