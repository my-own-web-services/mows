use crate::types::AppState;
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Extension,
};
use mows_common_rust::s;
use uuid::Uuid;

#[utoipa::path(
    get,
    path = "/files/content/get/{file_id}",
    params(
        ("file_id" = Uuid, Path, description = "The ID of the file to retrieve content for")
    ),
    responses(
        (status = 200, description = "Gets a single files data/content from the server" ),
        (status = 404, description = "File not found"),
        (status = 500, description = "Internal server error retrieving file content")
    )
)]
pub async fn get_file_content(
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_id): Path<Uuid>, // Assuming file_id is a UUID
) -> impl IntoResponse {
    let file_meta_res = app_state.db.get_file_by_id(file_id).await;

    timing.lock().unwrap().record(
        "db.get_file_by_id".to_string(),
        Some(s!("Database operation to get file metadata")),
    );

    let file_meta = match file_meta_res {
        Ok(Some(fm)) => fm,
        Ok(None) => {
            // If the file is not found, return a 404 Not Found response
            return (
                StatusCode::NOT_FOUND,
                HeaderMap::new(),
                Bytes::from("File not found"),
            );
        }
        Err(e) => {
            // Handle the error, e.g., log it or return an error response
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                HeaderMap::new(),
                Bytes::from(format!("Error retrieving file: {}", e)),
            );
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

    // Return the response with status code, headers, and body
    (StatusCode::OK, headers, Bytes::from(data))
}
