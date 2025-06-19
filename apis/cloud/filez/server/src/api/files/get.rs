use crate::{
    config::BUCKET_NAME, models::AccessPolicyResourceType, types::AppState, utils::parse_range,
};
use axum::{
    body::{Body, Bytes},
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
use minio::s3::types::S3Api;
use mows_common_rust::s;
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
    path = "/api/files/content/get/{file_id}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to retrieve content for"),
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
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_id): Path<Uuid>,
    Query(params): Query<GetFileRequestQueryParams>,
    request_headers: HeaderMap,
) -> impl IntoResponse {
    let requesting_user = match app_state
        .db
        .get_user_by_external_id(&external_user.user_id)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                HeaderMap::new(),
                Bytes::from("User not found"),
            )
                .into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Bytes::from(format!("Database error: {}", e)),
            )
                .into_response();
        }
    };

    timing.lock().unwrap().record(
        "db.get_user_by_external_id".to_string(),
        Some("Database operation to get user by external ID".to_string()),
    );

    let requesting_app_id = Uuid::default();
    let requesting_app_trusted = false;

    match app_state
        .db
        .check_resources_access_control(
            &requesting_user.id,
            &requesting_app_id,
            requesting_app_trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            &vec![file_id],
            "files:get_content",
        )
        .await
    {
        Ok(auth_result) => {
            if !auth_result.0 {
                return (
                    StatusCode::FORBIDDEN,
                    HeaderMap::new(),
                    Bytes::from("Access denied"),
                )
                    .into_response();
            }
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Bytes::from(format!("Access control check failed: {}", e)),
            )
                .into_response();
        }
    };

    timing.lock().unwrap().record(
        "db.check_resources_access_control".to_string(),
        Some(s!("Database operation to check access control")),
    );

    let file_meta_res = app_state.db.get_file_by_id(file_id).await;

    timing.lock().unwrap().record(
        "db.get_file_by_id".to_string(),
        Some(s!("Database operation to get file metadata")),
    );

    let file_meta = match file_meta_res {
        Ok(Some(fm)) => fm,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                HeaderMap::new(),
                Bytes::from("File not found"),
            )
                .into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Bytes::from(format!("Error retrieving file: {}", e)),
            )
                .into_response();
        }
    };

    // Create headers
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        file_meta
            .mime_type
            .parse()
            .expect("String to HeaderValue conversion failed"),
    );

    if params.d.unwrap_or(false) {
        // If the download parameter is set, set the content disposition header

        let file_name = if file_meta.file_name.is_empty() {
            let mime_string = match mime_guess::get_mime_extensions_str(&file_meta.mime_type) {
                Some(mime_strings) => match mime_strings.first() {
                    Some(mime_string) => mime_string.to_string(),
                    None => "bin".to_string(),
                },
                None => "bin".to_string(),
            };

            format!("file_{}.{}", file_meta.id, mime_string)
        } else {
            file_meta.file_name.clone()
        };

        headers.insert(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_name)
                .parse()
                .expect("String to HeaderValue conversion failed"),
        );
    }

    if let Some(cache_time) = params.c {
        // If the cache parameter is set, set the cache control header
        headers.insert(
            header::CACHE_CONTROL,
            format!("public, max-age={}", cache_time)
                .parse()
                .expect("String to HeaderValue conversion failed"),
        );
    }

    let mut get_object_query = app_state
        .minio_client
        .get_object(BUCKET_NAME, file_meta.id.to_string());

    if request_headers.contains_key(RANGE) {
        // TODO handle range
        if let Some(range) = request_headers.get(RANGE) {
            let range_str = range.to_str().unwrap_or("");
            let parsed_range = match parse_range(range_str) {
                Ok(r) => r,
                Err(e) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        HeaderMap::new(),
                        Bytes::from(format!("Invalid Range: {}", e)),
                    )
                        .into_response();
                }
            };

            get_object_query = get_object_query
                .offset(parsed_range.start.to_u64())
                .length(parsed_range.length.map(|l| l.to_u64().unwrap()));

            headers.insert(header::ACCEPT_RANGES, "bytes".parse().unwrap());
            headers.insert(header::CONNECTION, "Keep-Alive".parse().unwrap());
            headers.insert(
                HeaderName::from_static("keep-alive"),
                "timeout=5, max=100".parse().unwrap(),
            );

            let end = parsed_range
                .end
                .unwrap_or(&file_meta.size - BigDecimal::from(1));

            headers.insert(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", parsed_range.start, end, file_meta.size)
                    .parse()
                    .expect("String to HeaderValue conversion failed"),
            );
        }
    };

    let get_object_response = match get_object_query.send().await {
        Ok(response) => response,
        Err(e) => {
            // Handle the error, e.g., log it or return an error response
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Bytes::from(format!("Error retrieving file content: {}", e)),
            )
                .into_response();
        }
    };

    timing.lock().unwrap().record(
        "minio.get_object".to_string(),
        Some(s!("MinIO operation to get file content")),
    );

    let (stream, _size) = match get_object_response.content.to_stream().await {
        Ok(stream_info) => stream_info,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Bytes::from(format!("Error converting to stream: {}", e)),
            )
                .into_response();
        }
    };

    let body = Body::from_stream(stream);

    if request_headers.contains_key(RANGE) {
        (StatusCode::PARTIAL_CONTENT, headers, body).into_response()
    } else {
        (StatusCode::OK, headers, body).into_response()
    }
}
