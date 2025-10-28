use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::{DynamicGroupRule, FileGroup, FileGroupType},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/create",
    request_body = CreateFileGroupRequestBody,
    description = "Create a new file group",
    responses(
        (
            status = 200,
            description = "Created the file group",
            body = ApiResponse<CreateFileGroupResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<CreateFileGroupResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            None,
            AccessPolicyAction::FileGroupsCreate,
        )
        .await?
        .verify_allow_type_level()?,
        "Database operation to check access control",
        timing
    );

    let created_file_group = with_timing!(
        FileGroup::create_one(
            &database,
            &authentication_information.requesting_user.unwrap(),
            &request_body.file_group_name,
            request_body.file_group_type,
            request_body.dynamic_group_rule,
        )
        .await?,
        "Database operation to create file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group created".to_string(),
        data: Some(CreateFileGroupResponseBody { created_file_group }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateFileGroupRequestBody {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    pub file_group_name: String,
    pub file_group_type: FileGroupType,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateFileGroupResponseBody {
    pub created_file_group: FileGroup,
}
