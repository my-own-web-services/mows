//! POST /api/user_groups/{user_group_id}/invitations/accept
//!
//! The invitee accepts their pending invitation: deletes the
//! invitation row and inserts the membership row in a single
//! transaction. The invitee is identified by the authenticated
//! caller — no path param for user_id, deliberately, since only
//! the invitee can act on their own invitation.
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsRespondToInvite` on the
//! group. The default policy created at group setup grants this
//! action to "anyone with a row in user_user_group_invitations for
//! this group" — the existence of the invitation IS the consent.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{
            promote_pending_to_member, PendingMembershipKind, UserGroupId,
        },
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
    path = "/api/user_groups/{user_group_id}/invitations/accept",
    description = "Accept the caller's pending invitation to the group.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Invitation accepted; caller is now a member",
         body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "No pending invitation for the caller",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn accept_invitation(
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
            FilezError::Unauthorized("Anonymous callers cannot accept invitations".to_string())
        })?;

    let outcome = with_timing!(
        promote_pending_to_member(
            &database,
            PendingMembershipKind::Invitation,
            &user_group_id,
            &invitee.id,
        )
        .await?,
        "Database transaction: delete invitation + insert member",
        timing
    );

    if !outcome.existed {
        return Err(FilezError::ResourceNotFound(
            "No pending invitation for this user/group".to_string(),
        ));
    }
    if outcome.already_member {
        // Real race signal — the invitee was already a member via
        // another path (concurrent accept, or membership added
        // outside the invitation flow). Surface it to ops but
        // return success: the desired end state holds.
        tracing::warn!(
            user_id = %invitee.id,
            user_group_id = %user_group_id,
            "Invitation accepted but invitee was already a member — concurrent flow or duplicate path",
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Invitation accepted".to_string(),
        data: None,
    }))
}
