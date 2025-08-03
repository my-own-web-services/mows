use axum::{
    extract::{Path, State},
    Extension, Json,
};

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
    get,
    path = "/api/file_groups/get/{file_group_id}",
    params(
        ("file_group_id" = Uuid, Path, description = "The ID of the file group to retrieve"),
    ),
    responses(
        (status = 200, description = "Gets a file group by ID", body = ApiResponse<FileGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_group_id): Path<Uuid>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![file_group_id]),
            AccessPolicyAction::FileGroupsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_group = with_timing!(
        FileGroup::get_by_id(&database, &file_group_id).await?,
        "Database operation to get file group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group retrieved".to_string(),
        data: Some(file_group),
    }))
}
