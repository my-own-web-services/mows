//! Pending invitation dashboards. Mirror of the join-request list
//! endpoints — owner-facing per-group + caller-facing per-user.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
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
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListInvitationsResponseBody {
    pub invitations: Vec<UserUserGroupInvitation>,
}

#[utoipa::path(
    get,
    path = "/api/user_groups/{user_group_id}/invitations",
    description = "Owner-facing: list pending invitations for a group.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Pending invitations",
         body = ApiResponse<ListInvitationsResponseBody>),
        (status = 403, description = "Caller cannot manage this group",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_group_invitations(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
) -> Result<Json<ApiResponse<ListInvitationsResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsInvite,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let invitations = with_timing!(
        UserUserGroupInvitation::list_by_user_group(&database, &user_group_id).await?,
        "Database operation to list pending invitations",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Pending invitations".to_string(),
        data: Some(ListInvitationsResponseBody { invitations }),
    }))
}

#[utoipa::path(
    get,
    path = "/api/user_groups/my/invitations",
    description = "Caller-facing: list invitations addressed to the calling user.",
    responses(
        (status = 200, description = "Caller's pending invitations",
         body = ApiResponse<ListInvitationsResponseBody>),
        (status = 401, description = "Anonymous callers have no invitations",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_my_invitations(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
) -> Result<Json<ApiResponse<ListInvitationsResponseBody>>, FilezError> {
    let caller = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers have no invitations".to_string())
        })?;

    let invitations = with_timing!(
        UserUserGroupInvitation::list_by_user(&database, &caller.id).await?,
        "Database operation to list caller's invitations",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Caller's pending invitations".to_string(),
        data: Some(ListInvitationsResponseBody { invitations }),
    }))
}
