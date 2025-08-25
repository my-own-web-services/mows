use axum::{extract::State, Extension};
use crate::validation::Json;use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{UpdateUserGroupChangeset, UserGroup, UserGroupId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/user_groups/update",
    description = "Update an existing user group in the database",
    request_body = UpdateUserGroupRequestBody,
    responses(
        (
            status = 200,
            description = "Updated the user group",
            body = ApiResponse<UpdateUserGroupResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateUserGroupRequestBody>,
) -> Result<Json<ApiResponse<UpdateUserGroupResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_group_id.into()]),
            AccessPolicyAction::UserGroupsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_user_group = with_timing!(
        UserGroup::update_one(
            &database,
            &request_body.user_group_id,
            &request_body.changeset,
        )
        .await?,
        "Database operation to update user group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group updated".to_string(),
        data: Some(UpdateUserGroupResponseBody { updated_user_group }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateUserGroupRequestBody {
    pub user_group_id: UserGroupId,
    pub changeset: UpdateUserGroupChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateUserGroupResponseBody {
    pub updated_user_group: UserGroup,
}
