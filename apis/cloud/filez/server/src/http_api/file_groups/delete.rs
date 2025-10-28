use crate::validation::Json;
use axum::{
    extract::{Path, State},
    Extension,
};

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::{FileGroup, FileGroupId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    delete,
    path = "/api/file_groups/delete/{file_group_id}",
    description = "Delete a file group by its ID",
    params(
        (
            "file_group_id" = FileGroupId,
            Path,
            description = "The ID of the file group to delete"
        ),
    ),
    responses(
        (
            status = 200,
            description = "Deleted the file group",
            body = ApiResponse<String>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_file_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_group_id): Path<FileGroupId>,
) -> Result<Json<ApiResponse<String>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![file_group_id.into()]),
            AccessPolicyAction::FileGroupsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FileGroup::delete_one(&database, &file_group_id).await?,
        "Database operation to delete file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File group deleted".to_string(),
        data: Some(file_group_id.to_string()),
    }))
}
