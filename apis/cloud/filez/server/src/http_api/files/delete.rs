use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::{FilezFile, FilezFileId},
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
    path = "/api/files/delete/{file_id}",
    params(
        (
            "file_id" = FilezFileId,
            Path,
            description = "The ID of the file to delete"
        )
    ),
    description = "Delete a file entry in the database",
    responses(
        (
            status = 200,
            description = "Deleted a file on the server",
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
pub async fn delete_file(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_id): Path<FilezFileId>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&vec![file_id.into()]),
            AccessPolicyAction::FilezFilesDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FilezFile::delete_one(&database, file_id).await?,
        "Database operation to delete file",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse::<EmptyApiResponse> {
            status: ApiResponseStatus::Success {},
            message: "Deleted File".to_string(),
            data: None,
        }),
    ))
}
