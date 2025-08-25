use crate::{
    config::TUS_VERSION,
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsAppId,
        file_versions::FileVersion,
        files::FilezFileId,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    utils::OptionalPath,
    with_timing,
};
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension, Json,
};

#[utoipa::path(
    head,
    path = "/api/file_versions/content/tus/{file_id}/{version}/{app_id}/{app_path}",
    description = "Get the offset of a file version for resuming a Tus upload",
    params(
        (
            "file_id" = Uuid,
            Path,
            description = "The ID of the file to check for upload status"
        ),
        (
            "version" = Option<u32>,
            Path,
            description = "The version of the file, if applicable"
        ),
        (
            "app_id" = Option<Uuid>,
            Path,
            description = "The ID of the application that uploaded the file, if left empty, the app id is the filez server itself"
        ),
        (
            "app_path" = Option<String>,
            Path,
        )
    ),
    responses(
        (
            status = 200,
            body = ApiResponse<EmptyApiResponse>,
            description = "File exists and is ready to resume upload"
        ),
        (
            status = 404,
            body = ApiResponse<EmptyApiResponse>,
            description = "File not found"
        ),
        (
            status = 412,
            body = ApiResponse<EmptyApiResponse>,
            description = "Precondition failed due to missing or invalid Tus-Resumable header"
        ),
        (
            status = 400,
            body = ApiResponse<EmptyApiResponse>,
            description = "Bad request, missing or invalid headers"
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn file_versions_content_tus_head(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState {
        database,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((file_id, version, app_id, app_path)): Path<(
        FilezFileId,
        OptionalPath<u32>,
        OptionalPath<MowsAppId>,
        OptionalPath<String>,
    )>,
    request_headers: HeaderMap,
) -> Result<impl IntoResponse, FilezError> {
    let version = version.into();
    let app_id: Option<MowsAppId> = app_id.into();
    let app_path: Option<String> = app_path.into();

    if request_headers
        .get("Tus-Resumable")
        .ok_or_else(|| FilezError::InvalidRequest("Missing Tus-Resumable header".to_string()))?
        .to_str()
        .map_err(|_| FilezError::InvalidRequest("Invalid Tus-Resumable header".to_string()))?
        != TUS_VERSION
    {
        let mut response_headers = HeaderMap::new();
        response_headers.insert("Tus-Resumable", TUS_VERSION.parse().unwrap());
        return Ok((
            StatusCode::PRECONDITION_FAILED,
            response_headers,
            Json(ApiResponse::<EmptyApiResponse> {
                status: ApiResponseStatus::Error("GenericError".to_string()),
                message: "Invalid Tus-Resumable header".to_string(),
                data: None,
            }),
        ));
    };

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&vec![file_id.into()]),
            AccessPolicyAction::FilezFilesVersionsContentTusHead,
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
            &app_id.unwrap_or(MowsAppId::nil()),
            &app_path
        )
        .await,
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

    Ok((
        StatusCode::OK,
        response_headers,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Got Offset".to_string(),
            data: None,
        }),
    ))
}
