//! POST /api/user_groups/{user_group_id}/join_requests
//!
//! A user asks to join a `RequestToJoin` group, or joins directly
//! when the group is `OpenJoin`. `InviteOnly` groups refuse this
//! endpoint with 403.
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsRequestJoin` on the
//! target group.

use crate::{
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{UserGroup, UserGroupId},
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
use mows_auth_core::types::GroupJoinPolicy;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Validate, Clone, Debug, Default)]
pub struct RequestJoinUserGroupRequestBody {
    /// Optional message shown to the group owner alongside the
    /// pending request. Capped at 1024 chars (USER_GROUPS.md §6
    /// edge cases — avoid abuse of the dashboard).
    #[schema(max_length = 1024)]
    #[validate(max_length = 1024)]
    pub message: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/user_groups/{user_group_id}/join_requests",
    description = "Request to join a user group; direct-joins OpenJoin groups.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    request_body = RequestJoinUserGroupRequestBody,
    responses(
        (status = 200, description = "Request created or membership granted",
         body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Group is InviteOnly or caller lacks permission",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn request_to_join_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
    Json(request_body): Json<RequestJoinUserGroupRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsRequestJoin,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let requesting_user = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot join groups".to_string())
        })?;

    let user_group = with_timing!(
        UserGroup::get_one_by_id(&database, &user_group_id).await?,
        "Load target user group",
        timing
    );

    match user_group.join_policy {
        GroupJoinPolicy::OpenJoin => {
            // No owner approval required — insert membership directly.
            with_timing!(
                UserGroup::add_users(&database, &user_group_id, &vec![requesting_user.id.clone()])
                    .await?,
                "Database operation to add member (OpenJoin direct-join)",
                timing
            );
            Ok(Json(ApiResponse {
                status: ApiResponseStatus::Success {},
                message: "Joined user group".to_string(),
                data: None,
            }))
        }
        GroupJoinPolicy::RequestToJoin => {
            with_timing!(
                UserUserGroupJoinRequest::create_one(
                    &database,
                    &requesting_user.id,
                    &user_group_id,
                    request_body.message,
                )
                .await?,
                "Database operation to record pending join request",
                timing
            );
            Ok(Json(ApiResponse {
                status: ApiResponseStatus::Success {},
                message: "Join request submitted".to_string(),
                data: None,
            }))
        }
        GroupJoinPolicy::InviteOnly => Err(FilezError::Unauthorized(
            "This group is InviteOnly; ask the owner to invite you".to_string(),
        )),
    }
}
