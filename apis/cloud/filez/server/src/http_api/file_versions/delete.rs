use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionIdentifier},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/file_versions/delete",
    request_body = DeleteFileVersionsRequestBody,
    description = "Delete file versions in the database",
    responses(
        (status = 200, description = "Deleted file versions on the server", body = ApiResponse<DeleteFileVersionsResponseBody>),
        (status = 400, description = "Bad Request", body = ApiResponse<EmptyApiResponse>),
        (status = 401, description = "Unauthorized", body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Forbidden", body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "Not Found", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal Server Error", body = ApiResponse<EmptyApiResponse>)
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
    Json(request_body): Json<DeleteFileVersionsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let file_ids: Vec<Uuid> = request_body
        .versions
        .iter()
        .map(|v| v.file_id.into())
        .collect();

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&file_ids),
            AccessPolicyAction::FilezFilesVersionsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    FileVersion::delete_many(
        &storage_location_providers,
        &database,
        &request_body.versions,
        &timing,
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Deleted File Versions".to_string(),
            data: Some(DeleteFileVersionsResponseBody {
                versions: request_body.versions,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct DeleteFileVersionsRequestBody {
    pub versions: Vec<FileVersionIdentifier>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct DeleteFileVersionsResponseBody {
    pub versions: Vec<FileVersionIdentifier>,
}
