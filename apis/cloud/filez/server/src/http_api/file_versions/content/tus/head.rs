use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    config::TUS_VERSION,
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::FileVersion,
    },
    state::ServerState,
    with_timing,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};
use uuid::Uuid;

#[utoipa::path(
    head,
    path = "/api/file_versions/content/tus/{file_id}/{version}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to check for upload status"),
        ("version" = Option<u32>, Path, description = "The version of the file, if applicable"),
    ),
    responses(
        (status = 200, description = "File exists and is ready to resume upload"),
        (status = 404, description = "File not found"),
        (status = 412, description = "Precondition failed due to missing or invalid Tus-Resumable header"),
        (status = 400, description = "Bad request, missing or invalid headers"),
    )
)]
pub async fn file_versions_content_tus_head(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState {
        database,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((file_id, version)): Path<(Uuid, Option<u32>)>,
    request_headers: HeaderMap,
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

    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::File,
            Some(&vec![file_id]),
            AccessPolicyAction::FilezFilesVersionsContentTusHead,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_version = with_timing!(
        FileVersion::get(&database, &file_id, version, &Uuid::nil(), &None).await,
        "Database operation to get file metadata",
        timing
    )?;

    let real_content_size = file_version
        .get_file_size_from_content(&storage_location_providers, &database, &timing)
        .await?;

    let mut response_headers = HeaderMap::new();

    response_headers.insert("Tus-Resumable", "1.0.0".parse().unwrap());
    response_headers.insert(
        "Upload-Offset",
        real_content_size.to_string().parse().unwrap(),
    );

    response_headers.insert("Cache-Control", "no-store".parse().unwrap());
    response_headers.insert(
        "Upload-Length",
        file_version.size.to_string().parse().unwrap(),
    );

    Ok((StatusCode::OK, response_headers, ()))
}
