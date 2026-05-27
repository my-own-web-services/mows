//! Pending join-request dashboards.
//!
//! Two variants:
//!   * GET /api/user_groups/{user_group_id}/join_requests
//!       Owner-facing: every pending request for this group.
//!       Gated by `UserGroupsApprove` (the same authority that can
//!       act on the request — list and approve travel together).
//!   * GET /api/user_groups/my/join_requests
//!       Caller-facing: every pending request the calling user has
//!       sent. No per-group auth check — a user can always see
//!       their own pending requests.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroupId,
        user_user_group_join_requests::UserUserGroupJoinRequest,
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
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListJoinRequestsResponseBody {
    pub join_requests: Vec<UserUserGroupJoinRequest>,
}

#[utoipa::path(
    get,
    path = "/api/user_groups/{user_group_id}/join_requests",
    description = "Owner-facing: list pending join requests for a group.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Pending requests",
         body = ApiResponse<ListJoinRequestsResponseBody>),
        (status = 403, description = "Caller cannot manage this group",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_group_join_requests(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
) -> Result<Json<ApiResponse<ListJoinRequestsResponseBody>>, FilezError> {
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

    let join_requests = with_timing!(
        UserUserGroupJoinRequest::list_by_user_group(&database, &user_group_id).await?,
        "Database operation to list pending join requests",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Pending join requests".to_string(),
        data: Some(ListJoinRequestsResponseBody { join_requests }),
    }))
}

#[utoipa::path(
    get,
    path = "/api/user_groups/my/join_requests",
    description = "Caller-facing: list join requests the calling user has sent.",
    responses(
        (status = 200, description = "Caller's pending requests",
         body = ApiResponse<ListJoinRequestsResponseBody>),
        (status = 401, description = "Anonymous callers have no pending requests",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_my_join_requests(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
) -> Result<Json<ApiResponse<ListJoinRequestsResponseBody>>, FilezError> {
    let caller = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers have no pending requests".to_string())
        })?;

    let join_requests = with_timing!(
        UserUserGroupJoinRequest::list_by_user(&database, &caller.id).await?,
        "Database operation to list caller's join requests",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Caller's pending join requests".to_string(),
        data: Some(ListJoinRequestsResponseBody { join_requests }),
    }))
}
