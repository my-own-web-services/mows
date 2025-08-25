use axum::{extract::State, Extension};
use crate::validation::Json;use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroup,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/create",
    description = "Create a new user group in the database",
    request_body = CreateUserGroupRequestBody,
    responses(
        (
            status = 200,
            description = "Created the user group",
            body = ApiResponse<CreateUserGroupResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateUserGroupRequestBody>,
) -> Result<Json<ApiResponse<CreateUserGroupResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            None,
            AccessPolicyAction::UserGroupsCreate,
        )
        .await?
        .verify_allow_type_level()?,
        "Database operation to check access control",
        timing
    );

    let created_user_group = with_timing!(
        UserGroup::create_one(
            &database,
            &authentication_information.requesting_user.unwrap(),
            &request_body.user_group_name
        )
        .await?,
        "Database operation to create user group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group created".to_string(),
        data: Some(CreateUserGroupResponseBody { created_user_group }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateUserGroupRequestBody {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    pub user_group_name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateUserGroupResponseBody {
    pub created_user_group: UserGroup,
}
