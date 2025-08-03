use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::FileGroup,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/file_groups/update",
    request_body = UpdateFileGroupRequestBody,
    responses(
        (status = 200, description = "Updates a file group", body = ApiResponse<FileGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileGroupRequestBody>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![request_body.file_group_id]),
            AccessPolicyAction::FileGroupsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FileGroup::update(&database, &request_body.file_group_id, &request_body.name).await?,
        "Database operation to update file group",
        timing
    );

    let file_group = with_timing!(
        FileGroup::get_by_id(&database, &request_body.file_group_id).await?,
        "Database operation to get updated file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group updated".to_string(),
        data: Some(file_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileGroupRequestBody {
    pub file_group_id: Uuid,
    pub name: String,
}
