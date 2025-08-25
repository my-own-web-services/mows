use axum::{extract::State, Extension};
use crate::validation::Json;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{UserGroup, UserGroupId},
        users::FilezUserId,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/update_members",
    description = "Update the members of a user group by adding or removing users",
    request_body = UpdateUserGroupMembersRequestBody,
    responses(
        (
            status = 200,
            description = "Updated the members of the user group",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_user_group_members(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateUserGroupMembersRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_group_id.into()]),
            AccessPolicyAction::UserGroupsUpdateMembers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    if let Some(users_to_add) = request_body.users_to_add {
        with_timing!(
            UserGroup::add_users(&database, &request_body.user_group_id, &users_to_add).await?,
            "Database operation to add users to user group",
            timing
        );
    }

    if let Some(users_to_remove) = request_body.users_to_remove {
        with_timing!(
            UserGroup::remove_users(&database, &request_body.user_group_id, &users_to_remove)
                .await?,
            "Database operation to remove users from user group",
            timing
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group members updated".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: UserGroupId,
    pub users_to_add: Option<Vec<FilezUserId>>,
    pub users_to_remove: Option<Vec<FilezUserId>>,
}
