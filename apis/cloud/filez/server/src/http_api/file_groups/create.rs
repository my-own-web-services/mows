use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
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
    responses(
        (status = 200, description = "Creates a new file group", body = ApiResponse<FileGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
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

    let file_group = FileGroup::new(
        &authentication_information.requesting_user.unwrap(),
        &request_body.name,
        request_body.group_type,
        request_body.dynamic_group_rule,
    );

    with_timing!(
        FileGroup::create(&database, &file_group).await?,
        "Database operation to create file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group created".to_string(),
        data: Some(file_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct CreateFileGroupRequestBody {
    pub name: String,
    pub group_type: FileGroupType,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
}
