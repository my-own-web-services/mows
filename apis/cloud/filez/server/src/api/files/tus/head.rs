use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};

use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    apps::FilezApp,
    config::TUS_VERSION,
    errors::FilezError,
    models::{AccessPolicyAction, AccessPolicyResourceType},
    state::ServerState,
    with_timing,
};

#[utoipa::path(
    head,
    path = "/api/files/tus/head/{file_id}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to check for upload status")
    ),
    responses(
        (status = 200, description = "File exists and is ready to resume upload"),
        (status = 404, description = "File not found"),
        (status = 412, description = "Precondition failed due to missing or invalid Tus-Resumable header"),
        (status = 400, description = "Bad request, missing or invalid headers"),
    )
)]
pub async fn tus_head(
    external_user: IntrospectedUser,
    State(ServerState {
        db,
        storage_locations,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_id): Path<Uuid>,
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

    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        FilezApp::get_app_from_headers(&request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        db.check_resources_access_control(
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            &vec![file_id],
            &serde_variant::to_variant_name(&AccessPolicyAction::FilesContentTusHead).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file = with_timing!(
        db.get_file_by_id(file_id).await?,
        "Database operation to get file by ID",
        timing
    )
    .ok_or(FilezError::ResourceNotFound(format!(
        "File with ID {} not found",
        file_id
    )))?;

    let real_content_size = file
        .get_file_size_from_content(storage_locations, timing, None)
        .await?;

    let mut response_headers = HeaderMap::new();

    response_headers.insert("Tus-Resumable", "1.0.0".parse().unwrap());
    response_headers.insert(
        "Upload-Offset",
        real_content_size.to_string().parse().unwrap(),
    );

    response_headers.insert("Cache-Control", "no-store".parse().unwrap());
    response_headers.insert("Upload-Length", file.size.to_string().parse().unwrap());

    Ok((StatusCode::OK, response_headers, ()))
}
