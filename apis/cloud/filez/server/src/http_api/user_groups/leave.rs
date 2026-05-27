//! POST /api/user_groups/{user_group_id}/leave
//!
//! Member self-removes from a group. Idempotent — a non-member
//! returns 200 (security-equivalent: caller is not a member).
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsLeave` on the target
//! group. Owners cannot leave their own group via this endpoint
//! (USER_GROUPS.md §7 edge case: "Demoting an owner — cannot
//! happen — only way out is to transfer ownership first"). The
//! handler returns 403 in that case.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{UserGroup, UserGroupId},
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
    path = "/api/user_groups/{user_group_id}/leave",
    description = "Leave a user group (caller removes their own membership).",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Left the group (or was already not a member)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Caller is the group's owner",
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
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsLeave,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let leaving = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot leave groups".to_string())
        })?;

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
