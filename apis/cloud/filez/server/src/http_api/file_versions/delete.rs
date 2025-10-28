use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};

#[utoipa::path(
    delete,
    path = "/api/file_versions/delete/{file_version_id}",
    params(
        (
            "file_version_id" = FileVersionId,
            Path,
            description = "The ID of the file version to delete"
        )
    ),
    description = "Delete file versions in the database",
    responses(
        (
            status = 200,
            description = "Deleted file version on the server",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 400,
            description = "Bad Request",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 401,
            description = "Unauthorized",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 403,
            description = "Forbidden",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 404,
            description = "Not Found",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        )
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_file_versions(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState {
        database,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_version_id): Path<FileVersionId>,
) -> Result<impl IntoResponse, FilezError> {
    let file_version = with_timing!(
        FileVersion::get_by_id(&database, &file_version_id).await?,
        "Database operation to get file version by ID",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&vec![file_version.file_id.into()]),
            AccessPolicyAction::FilezFilesVersionsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    FileVersion::delete(
        &storage_location_providers,
        &database,
        &file_version,
        &timing,
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::<EmptyApiResponse> {
            status: ApiResponseStatus::Success {},
            message: "Deleted File Version".to_string(),
            data: None,
        }),
    ))
}
