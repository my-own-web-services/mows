//! POST /api/user_groups/{user_group_id}/join_requests/{user_id}/reject
//!
//! Owner rejects a pending join request: deletes the request row.
//! Idempotent — a missing request returns 200 (silently treated as
//! "already resolved"), since the security-relevant outcome is the
//! same: no membership was created.
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsApprove` (same authority
//! as approve; if you can approve you can reject).

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroupId,
        user_user_group_join_requests::UserUserGroupJoinRequest,
        users::FilezUserId,
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
    path = "/api/user_groups/{user_group_id}/join_requests/{user_id}/reject",
    description = "Reject a pending join request (idempotent).",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
        ("user_id"       = FilezUserId, Path, description = "User whose request is being rejected"),
    ),
    responses(
        (status = 200, description = "Request rejected (or was already gone)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn reject_join_request(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((user_group_id, user_id)): Path<(UserGroupId, FilezUserId)>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsApprove,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        UserUserGroupJoinRequest::delete_one(&database, &user_id, &user_group_id).await?,
        "Database operation to delete join request",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Join request rejected".to_string(),
        data: None,
    }))
}
