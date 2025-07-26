use crate::{
    config::TUS_VERSION,
    errors::{FileVersionSizeExceededErrorBody, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::FileVersion,
    },
    state::ServerState,
    types::ApiResponse,
    with_timing,
};
use axum::{
    extract::{Path, Request, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};
use bigdecimal::ToPrimitive;
use uuid::Uuid;

#[utoipa::path(
    tag = "FileVersion",
    description = "Patch a file version using the TUS protocol. The file and the file version must exist. If the file version is marked as verified it cannot be patched, unless the expected checksum is updated or removed.",
    patch,
    request_body(content_type = "application/offset+octet-stream"),
    path = "/api/file_versions/content/tus/{file_id}/{version}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to patch"),
        ("version" = Option<u32>, Path, description = "The version of the file to patch, if applicable"),
    ),
    responses(
        (status = 204, description = "File was successfully patched"),
        (status = 404, description = "File not found"),
        (status = 412, description = "Precondition failed, likely due to missing or invalid Tus-Resumable header"),
        (status = 400, description = "Bad request, missing or invalid headers"),
        (status = 415, description = "Unsupported media type, Content-Type must be application/offset+octet-stream"),
        (status = 413, description = "File version size exceeded, the size of the file version exceeds the allowed limit",
            body = ApiResponse<FileVersionSizeExceededErrorBody>),
        (status = 500, description = "Internal server error, unexpected error occurred while processing the request")
    )
)]
pub async fn file_versions_content_tus_patch(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState {
        database,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((file_id, version)): Path<(Uuid, Option<u32>)>,
    request_headers: HeaderMap,
    request: Request,
) -> Result<impl IntoResponse, FilezError> {
    if request_headers
        .get("Tus-Resumable")
        .ok_or_else(|| FilezError::InvalidRequest("Missing Tus-Resumable header".to_string()))?
        .to_str()
        .map_err(|_| FilezError::InvalidRequest("Invalid Tus-Resumable header".to_string()))?
        != TUS_VERSION
    {
        let mut response_headers = HeaderMap::new();
        response_headers.insert("Tus-Resumable", TUS_VERSION.parse().unwrap());
        return Ok((StatusCode::PRECONDITION_FAILED, response_headers, ()));
    };

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

    let request_upload_offset = request_headers
        .get("Upload-Offset")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .ok_or_else(|| {
            FilezError::InvalidRequest("Missing or invalid Upload-Offset header".to_string())
        })?;

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
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::File,
            Some(&vec![file_id]),
            AccessPolicyAction::FilezFilesVersionsContentTusPatch,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_version = with_timing!(
        FileVersion::get(&database, &file_id, version, &Uuid::nil(), &None).await?,
        "Database operation to get file version",
        timing
    );

    if request_upload_offset + content_length > file_version.size.to_u64().unwrap() {
        return Err(FilezError::FileVersionSizeExceeded {
            allowed: file_version.size.to_u64().unwrap(),
            received: request_upload_offset + content_length,
        });
    }

    file_version
        .set(
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

    response_headers.insert("Tus-Resumable", "1.0.0".parse().unwrap());
    response_headers.insert(
        "Upload-Offset",
        new_upload_offset.to_string().parse().unwrap(),
    );

    Ok((StatusCode::NO_CONTENT, response_headers, ()))
}
