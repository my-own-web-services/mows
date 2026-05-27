//! POST /api/user_groups/{user_group_id}/invitations/accept
//!
//! The invitee accepts their pending invitation: deletes the
//! invitation row and inserts the membership row in a single
//! transaction. The invitee is identified by the authenticated
//! caller — no path param for user_id, deliberately, since only
//! the invitee can act on their own invitation.
//!
//! **Authorization model** (USER_GROUPS.md §6): the existence of
//! the invitation row IS the authorization signal. The handler
//! does NOT call `AccessPolicy::check(UserGroupsRespondToInvite)`
//! because that check would either need a per-invitation policy
//! seeded at invite time (huge churn for transient state) or a
//! blanket "any user can RespondToInvite on any group" policy
//! (overly broad). Instead the transactional DELETE of the
//! invitation row is the source of truth: if the affected count is
//! zero, the caller had no pending invitation and we return 404.
//! This matches the spec wording ("the existence of the invitation
//! IS the consent").

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::user_groups::{
        promote_pending_to_member, PendingMembershipKind, UserGroupId,
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
        (status = 401, description = "Anonymous callers cannot accept",
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
    let invitee = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot accept invitations".to_string())
        })?;

    // Row-based auth: the transactional DELETE inside
    // `promote_pending_to_member` returns affected=0 when the
    // (invitee, group) invitation doesn't exist — that's the 404
    // signal. No AccessPolicy::check needed; the invitation row IS
    // the consent (see module docstring).
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
