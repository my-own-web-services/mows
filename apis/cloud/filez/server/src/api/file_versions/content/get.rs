use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_versions::FileVersion,
        files::FilezFile,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, EmptyApiResponse},
    utils::parse_range,
    with_timing,
};
use axum::{
    extract::{Path, Query, State},
    http::{
        header::{self, RANGE},
        HeaderMap, HeaderName, StatusCode,
    },
    response::IntoResponse,
    Extension,
};
use bigdecimal::BigDecimal;
use bigdecimal::ToPrimitive;
use serde::Deserialize;
use utoipa::IntoParams;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[derive(Deserialize, IntoParams)]
pub struct GetFileVersionRequestQueryParams {
    /// download the file/set the content disposition header to attachment
    pub d: Option<bool>,
    /// request setting the caching headers for max-age in seconds
    pub c: Option<u64>,
}

#[utoipa::path(
    get,
    path = "/api/file_versions/content/get/{file_id}/{version}/{app_id}/{app_path}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to retrieve content for"),
        ("version" = Option<u32>, Path, description = "The version of the file to retrieve, if applicable"),
        ("app_id" = Option<Uuid>, Path),
        ("app_path" = Option<String>, Path),
        GetFileVersionRequestQueryParams
    ),
    responses(
        (status = 200, description = "Gets a single files data/content from the server", body = Vec<u8> ),
        (status = 206, description = "Partial content returned due to range request", body = Vec<u8>),
        (status = 404, description = "File not found", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error retrieving file content", body = ApiResponse<EmptyApiResponse>)
    )
)]
pub async fn get_file_version_content(
    external_user: IntrospectedUser,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((file_id, version, app_id, app_path)): Path<(
        Uuid,
        Option<u32>,
        Option<Uuid>,
        Option<String>,
    )>,
    Query(params): Query<GetFileVersionRequestQueryParams>,
    request_headers: HeaderMap,
) -> Result<impl IntoResponse, FilezError> {
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
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::File,
            Some(&vec![file_id]),
            AccessPolicyAction::FilezFilesVersionsContentGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_meta = with_timing!(
        FilezFile::get_by_id(&db, file_id).await,
        "Database operation to get file",
        timing
    )?;

    let file_version_meta = with_timing!(
        FileVersion::get(
            &db,
            &file_id,
            version,
            &app_id.as_ref().unwrap_or(&Uuid::nil()),
            &app_path
        )
        .await,
        "Database operation to get file metadata",
        timing
    )?;

    // Create headers
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::CONTENT_TYPE,
        file_meta
            .mime_type
            .parse()
            .expect("String to HeaderValue conversion failed"),
    );

    if params.d.unwrap_or(false) {
        // If the download parameter is set, set the content disposition header

        let file_name = if file_meta.name.is_empty() {
            let mime_string = match mime_guess::get_mime_extensions_str(&file_meta.mime_type) {
                Some(mime_strings) => match mime_strings.first() {
                    Some(mime_string) => mime_string.to_string(),
                    None => "bin".to_string(),
                },
                None => "bin".to_string(),
            };

            format!("file_{}.{}", file_meta.id, mime_string)
        } else {
            file_meta.name.clone()
        };

        response_headers.insert(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_name)
                .parse()
                .map_err(|e| {
                    FilezError::GenericError(anyhow::anyhow!(
                        "Failed to parse content disposition header: {}",
                        e
                    ))
                })?,
        );
    }

    if let Some(cache_time) = params.c {
        // If the cache parameter is set, set the cache control header
        response_headers.insert(
            header::CACHE_CONTROL,
            format!("public, max-age={}", cache_time)
                .parse()
                .map_err(|e| {
                    FilezError::GenericError(anyhow::anyhow!(
                        "Failed to parse cache control header: {}",
                        e
                    ))
                })?,
        );
    }

    let range = if request_headers.contains_key(RANGE) {
        if let Some(range) = request_headers.get(RANGE) {
            let range_str = range.to_str().unwrap_or("");
            let parsed_range = parse_range(range_str)?;

            response_headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
            response_headers.insert(header::CONNECTION, "Keep-Alive".parse().unwrap());
            response_headers.insert(
                HeaderName::from_static("keep-alive"),
                "timeout=5, max=100".parse().unwrap(),
            );

            let end = parsed_range
                .end
                .unwrap_or(&file_version_meta.size - BigDecimal::from(1));

            response_headers.insert(
                header::CONTENT_RANGE,
                format!(
                    "bytes {}-{}/{}",
                    parsed_range.start, end, file_version_meta.size
                )
                .parse()
                .expect("String to HeaderValue conversion failed"),
            );
            Some((parsed_range.start.to_u64(), end.to_u64()))
        } else {
            None
        }
    } else {
        None
    };

    let body = file_version_meta.get_content(&db, timing, &range).await?;

    if range.is_some() {
        Ok((StatusCode::PARTIAL_CONTENT, response_headers, body).into_response())
    } else {
        Ok((StatusCode::OK, response_headers, body).into_response())
    }
}
