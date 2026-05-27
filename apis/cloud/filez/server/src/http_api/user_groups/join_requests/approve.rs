//! POST /api/user_groups/{user_group_id}/join_requests/{user_id}/approve
//!
//! Owner approves a pending join request: deletes the request row and
//! inserts the membership row in a single transaction. Idempotent —
//! if the request is gone (already approved/rejected), returns 404.
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsApprove` on the group.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{
            promote_pending_to_member, PendingMembershipKind, UserGroupId,
        },
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
    path = "/api/user_groups/{user_group_id}/join_requests/{user_id}/approve",
    description = "Approve a pending join request; inserts the membership row in one transaction.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
        ("user_id"       = FilezUserId, Path, description = "User whose request is being approved"),
    ),
    responses(
        (status = 200, description = "Request approved; user is now a member",
         body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "No pending request for that (user, group)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn approve_join_request(
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

    let outcome = with_timing!(
        promote_pending_to_member(
            &database,
            PendingMembershipKind::JoinRequest,
            &user_group_id,
            &user_id,
        )
        .await?,
        "Database transaction: delete request + insert member",
        timing
    );

    if !outcome.existed {
        return Err(FilezError::ResourceNotFound(
            "No pending join request for that (user, group)".to_string(),
        ));
    }
    if outcome.already_member {
        // Real race signal — the requester was already a member via
        // a concurrent OpenJoin auto-promote or another approve.
        // Treat as success but surface to ops.
        tracing::warn!(
            user_id = %user_id,
            user_group_id = %user_group_id,
            "Join request approved but requester was already a member — concurrent flow or duplicate path",
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Join request approved".to_string(),
        data: None,
    }))
}
