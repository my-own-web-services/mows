use crate::{
    errors::{FileVersionSizeExceededErrorBody, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::FileVersion,
        files::FilezFileId,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    utils::OptionalPath,
    with_timing,
};
use axum::{
    extract::{Path, Query, Request, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct PatchQueryParams {
    #[serde(rename = "upload_offset")]
    pub upload_offset: u64,
}

#[utoipa::path(
    tag = "FileVersion",
    description = "Patch a file version using the TUS protocol. The file and the file version must exist. If the file version is marked as verified it cannot be patched, unless the expected checksum is updated or removed.",
    patch,
    request_body(
        content_type = "application/offset+octet-stream"
    ),
    path = "/api/file_versions/content/tus/{file_id}/{version}/{app_path}",
    params(
        (
            "file_id" = Uuid,
            Path,
            description = "The ID of the file to patch"
        ),
        (
            "version" = Option<u32>,
            Path,
            description = "The version of the file to patch"
        ),
        (
            "app_path" = Option<String>,
            Path
        ),
        (
            "upload_offset" = u64,
            Query,
            description = "The current upload offset in bytes"
        ),
    ),
    responses(
        (
            status = 204,
            body = ApiResponse<EmptyApiResponse>,
            description = "File was successfully patched"
        ),
        (
            status = 404,
            body = ApiResponse<EmptyApiResponse>,
            description = "File not found"
        ),
        (
            status = 400,
            body = ApiResponse<EmptyApiResponse>,
            description = "Bad request, missing or invalid headers"
        ),
        (
            status = 415,
            body = ApiResponse<EmptyApiResponse>,
            description = "Unsupported media type, Content-Type must be application/offset+octet-stream"
        ),
        (
            status = 413,
            description = "File version size exceeded, the size of the file version exceeds the allowed limit",
            body = ApiResponse<FileVersionSizeExceededErrorBody>
        ),
        (
            status = 500,
            body = ApiResponse<EmptyApiResponse>,
            description = "Internal server error, unexpected error occurred while processing the request"
        )
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn file_versions_content_tus_patch(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState {
        database,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((file_id, version, app_path)): Path<(
        FilezFileId,
        OptionalPath<u32>,
        OptionalPath<String>,
    )>,
    Query(query_params): Query<PatchQueryParams>,
    request_headers: HeaderMap,
    request: Request,
) -> Result<impl IntoResponse, FilezError> {
    let version = version.into();
    let app_path: Option<String> = app_path.into();

    if request_headers
        .get("Content-Type")
        .ok_or_else(|| {
            FilezError::UnsupportedMediaType("Missing or invalid Content-Type header".to_string())
        })?
        .to_str()
        .map_err(|_| FilezError::UnsupportedMediaType("Invalid Content-Type header".to_string()))?
        != "application/offset+octet-stream"
    {
        return Err(FilezError::UnsupportedMediaType(
            "Invalid Content-Type header, must be application/offset+octet-stream".to_string(),
        ));
    }

    let request_upload_offset = query_params.upload_offset;

    let content_length = request_headers
        .get("Content-Length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .ok_or_else(|| {
            FilezError::InvalidRequest("Missing or invalid Content-Length header".to_string())
        })?;

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&vec![file_id.into()]),
            AccessPolicyAction::FilezFilesVersionsContentTusPatch,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_version = with_timing!(
        FileVersion::get_one_by_identifier(
            &database,
            &file_id,
            version,
            &authentication_information.requesting_app.id,
            &app_path
        )
        .await?,
        "Database operation to get file version",
        timing
    );

    let file_version_size: u64 = file_version.size.try_into()?;

    if request_upload_offset + content_length > file_version_size {
        return Err(FilezError::FileVersionSizeExceeded {
            allowed: file_version_size,
            received: request_upload_offset + content_length,
        });
    }

    file_version
        .set_content(
            &storage_location_providers,
            &database,
            &timing,
            request,
            request_upload_offset,
            content_length,
        )
        .await?;

    let mut response_headers = HeaderMap::new();

    let new_upload_offset: u64 = request_upload_offset
        .checked_add(content_length)
        .ok_or_else(|| FilezError::InvalidRequest("Upload-Offset overflow".to_string()))?;

    response_headers.insert(
        "Upload-Offset",
        new_upload_offset.to_string().parse().unwrap(),
    );

    Ok((
        StatusCode::OK,
        response_headers,
        Json(ApiResponse::<EmptyApiResponse> {
            status: ApiResponseStatus::Success {},
            message: "Success".to_string(),
            data: None,
        }),
    ))
}
