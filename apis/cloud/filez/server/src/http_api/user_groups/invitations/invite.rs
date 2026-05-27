//! POST /api/user_groups/{user_group_id}/invitations
//!
//! Group owner invites a user. Works for InviteOnly and
//! RequestToJoin groups (USER_GROUPS.md §6). OpenJoin groups don't
//! need invitations, but we still accept the call as a hint to the
//! invitee — the dashboard surfaces "you've been invited to join
//! <group>" even when they could have joined directly.
//!
//! Gated by `UserGroupsInvite` on the target group.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroupId,
        user_user_group_invitations::UserUserGroupInvitation,
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
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Validate, Clone, Debug)]
pub struct InviteToUserGroupRequestBody {
    pub user_id: FilezUserId,
    /// Optional message shown to the invitee. Capped at 1024 chars.
    #[schema(max_length = 1024)]
    #[validate(max_length = 1024)]
    pub message: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/user_groups/{user_group_id}/invitations",
    description = "Invite a user to a group. Idempotent — re-invites are a no-op.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    request_body = InviteToUserGroupRequestBody,
    responses(
        (status = 200, description = "Invitation recorded",
         body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Caller is not the owner",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn invite_to_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
    Json(request_body): Json<InviteToUserGroupRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
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

    let inviter = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot invite".to_string())
        })?;

    with_timing!(
        UserUserGroupInvitation::create_one(
            &database,
            &request_body.user_id,
            &user_group_id,
            &inviter.id,
            request_body.message,
        )
        .await?,
        "Database operation to record invitation",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Invitation sent".to_string(),
        data: None,
    }))
}
