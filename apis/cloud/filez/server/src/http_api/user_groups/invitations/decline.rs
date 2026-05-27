//! POST /api/user_groups/{user_group_id}/invitations/decline
//!
//! Invitee declines their pending invitation. Idempotent — a
//! missing invitation returns 200, since the security-relevant
//! outcome is the same: no membership exists.
//!
//! Gated by `UserGroupsRespondToInvite` (same authority as accept).

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
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsRespondToInvite,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

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
