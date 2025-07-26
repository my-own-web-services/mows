use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication_middleware::AuthenticationInformation,
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
pub async fn create_file_group(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
    with_timing!(
                AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::FileGroup,
            None,
            AccessPolicyAction::FileGroupsCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_group = FileGroup::new(
        &requesting_user.unwrap(),
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
        status: ApiResponseStatus::Success,
        message: "File group created".to_string(),
        data: Some(file_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileGroupRequestBody {
    pub name: String,
    pub group_type: FileGroupType,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
}
