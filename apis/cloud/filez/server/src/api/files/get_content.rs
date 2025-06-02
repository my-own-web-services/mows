use crate::{config::BUCKET_NAME, types::AppState};
use axum::{
    body::{Body, Bytes},
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};
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
    /// request setting the caching headers
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
    user: IntrospectedUser,
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_id): Path<Uuid>,
    Query(params): Query<GetFileRequestQueryParams>,
) -> impl IntoResponse {
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

            format!("file_{}.{}", file_meta.file_id, mime_string)
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

    let get_object_response = match app_state
        .minio_client
        .get_object(BUCKET_NAME, file_meta.file_id.to_string())
        .send()
        .await
    {
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

    (StatusCode::OK, headers, body).into_response()
}
