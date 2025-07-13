use crate::{
    config::TUS_VERSION,
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_versions::FileVersion,
        users::FilezUser,
    },
    state::ServerState,
    with_timing,
};
use axum::{
    extract::{Path, Request, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    patch,
    request_body(content_type = "application/octet-stream"),
      path = "/api/files/versions/content/tus/patch/{file_id}/{version}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to patch"),
        ("version" = Option<u32>, Path, description = "The version of the file to patch, if applicable"),
    ),
    responses(
        (status = 204, description = "File was successfully patched"),
        (status = 404, description = "File not found"),
        (status = 412, description = "Precondition failed, likely due to missing or invalid Tus-Resumable header"),
        (status = 400, description = "Bad request, missing or invalid headers"),
    )
)]
pub async fn tus_patch(
    external_user: IntrospectedUser,
    State(ServerState { db, .. }): State<ServerState>,
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

    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            Some(&vec![file_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::FilezFilesVersionsContentTusPatch)
                .unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_version = with_timing!(
        FileVersion::get(&db, &file_id, version, &Uuid::nil(), &None).await?,
        "Database operation to get file version",
        timing
    );

    file_version
        .update_content(&db, timing, request, request_upload_offset, content_length)
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
