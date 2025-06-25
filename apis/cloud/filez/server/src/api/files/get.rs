use crate::{
    apps::FilezApp,
    errors::FilezError,
    models::{AccessPolicyAction, AccessPolicyResourceType},
    state::ServerState,
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
pub struct GetFileRequestQueryParams {
    /// download the file/set the content disposition header to attachment
    pub d: Option<bool>,
    /// request setting the caching headers for max-age in seconds
    pub c: Option<u64>,
}

#[utoipa::path(
    get,
    path = "/api/files/content/get/{file_id}/{app_id}/{app_path}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to retrieve content for"),
        ("app_id" = Option<Uuid>, Path, description = "The type of preview to retrieve, if applicable"),
        ("app_path" = Option<String>, Path, description = "The path to the file preview, if applicable"),
        GetFileRequestQueryParams
    ),
    responses(
        (status = 200, description = "Gets a single files data/content from the server" ),
        (status = 404, description = "File not found"),
        (status = 500, description = "Internal server error retrieving file content")
    )
)]
pub async fn get_file_content(
    external_user: IntrospectedUser,
    State(ServerState {
        db,
        storage_locations,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((file_id, app_id, app_path)): Path<(Uuid, Option<Uuid>, Option<String>)>,
    Query(params): Query<GetFileRequestQueryParams>,
    request_headers: HeaderMap,
) -> Result<impl IntoResponse, FilezError> {
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
            &serde_variant::to_variant_name(&AccessPolicyAction::FilesContentGet).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_meta = with_timing!(
        db.get_file_by_id(file_id).await?,
        "Database operation to get file metadata",
        timing
    )
    .ok_or(FilezError::ResourceNotFound(format!(
        "File with ID {} not found",
        file_id
    )))?;

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
                .unwrap_or(&file_meta.size - BigDecimal::from(1));

            response_headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", parsed_range.start, end, file_meta.size)
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

    let body = file_meta
        .get_content(storage_locations, timing, range, app_id, app_path)
        .await?;

    if range.is_some() {
        Ok((StatusCode::PARTIAL_CONTENT, response_headers, body).into_response())
    } else {
        Ok((StatusCode::OK, response_headers, body).into_response())
    }
}
