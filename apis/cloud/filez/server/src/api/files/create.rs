use std::str::FromStr;

use axum::{
    extract::{Request, State},
    http::HeaderMap,
    Extension, Json,
};
use chrono::NaiveDateTime;
use futures_util::TryStreamExt;
use mime_guess::Mime;
use minio::s3::builders::ObjectContent;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    config::BUCKET_NAME,
    models::File,
    types::{ApiResponse, ApiResponseStatus, AppState},
    validation::validate_file_name,
};

#[utoipa::path(
    post,
    path = "/api/files/create",
    request_body(content_type = "application/octet-stream"),
    responses(
        (status = 200, description = "Created a file on the server", body = ApiResponse<CreateFileResponseBody>),
    )
)]
pub async fn create_file(
    external_user: IntrospectedUser,

    headers: HeaderMap,
    State(app_state): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    request: Request,
) -> Json<ApiResponse<CreateFileResponseBody>> {
    // Check if the user is authenticated

    let requesting_user = match app_state
        .db
        .get_user_by_external_id(&external_user.user_id)
        .await
    {
        Ok(Some(u)) => u,
        Ok(None) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: "User not found".to_string(),
                data: None,
            });
        }
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Database error: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.get_user_by_external_id".to_string(),
        Some("Database operation to get user by external ID".to_string()),
    );

    let file_size = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok());

    let file_size = match file_size {
        Some(size) => size,
        None => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: "Missing or invalid content-length header".to_string(),
                data: None,
            });
        }
    };

    let meta_body: CreateFileRequestBody =
        match serde_json::from_str(&headers.get("x-filez-metadata").unwrap().to_str().unwrap()) {
            Ok(body) => body,
            Err(e) => {
                return Json(ApiResponse {
                    status: ApiResponseStatus::Error,
                    message: format!("Failed to parse request body HEADER: {}", e),
                    data: None,
                });
            }
        };
    let mime_type = match meta_body.mime_type {
        Some(mime) => match Mime::from_str(&mime) {
            Ok(m) => m,
            Err(e) => {
                return Json(ApiResponse {
                    status: ApiResponseStatus::Error,
                    message: format!("Invalid MIME type: {}", e),
                    data: None,
                });
            }
        },
        None => {
            // guess the MIME type based on the file name
            if let Some(m) = mime_guess::from_path(&meta_body.file_name).first() {
                m
            } else {
                return Json(ApiResponse {
                    status: ApiResponseStatus::Error,
                    message: "Failed to guess MIME type from file name".to_string(),
                    data: None,
                });
            }
        }
    };

    if let Err(e) = validate_file_name(&meta_body.file_name).await {
        return Json(ApiResponse {
            status: ApiResponseStatus::Error,
            message: format!("Invalid file name: {}", e),
            data: None,
        });
    }

    // Check if the file size is within the allowed limits
    let user_used_storage = match app_state
        .db
        .get_user_used_storage(&requesting_user.id)
        .await
    {
        Ok(size) => size,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to get user storage: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.get_user_used_storage".to_string(),
        Some("Database operation to get the storage used by the user".to_string()),
    );

    if &user_used_storage + file_size > requesting_user.storage_limit {
        return Json(ApiResponse {
            status: ApiResponseStatus::Error,
            message: format!(
                "User storage limit exceeded: {} bytes used, limit is {} bytes",
                user_used_storage, requesting_user.storage_limit
            ),
            data: None,
        });
    }

    // Create a new file entry in the database
    let new_file = File::new(
        &requesting_user,
        &mime_type,
        &meta_body.file_name,
        file_size,
    );

    let db_created_file = match app_state.db.create_file(&new_file).await {
        Ok(id) => id,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to create file: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "db.create_file".to_string(),
        Some("Database operation to create a new file entry".to_string()),
    );

    let stream = request
        .into_body()
        .into_data_stream()
        .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

    let object_content = ObjectContent::new_from_stream(stream, Some(file_size));

    match app_state
        .minio_client
        .put_object_content(BUCKET_NAME, db_created_file.id, object_content)
        .content_type(mime_type.to_string())
        .send()
        .await
    {
        Ok(_) => {}
        Err(e) => {
            // If the file upload fails, delete the file entry from the database
            if let Err(db_error) = app_state.db.delete_file(db_created_file.id).await {
                tracing::error!(
                    "Failed to delete file from database after upload failure: {}",
                    db_error
                );
            }
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Failed to upload file: {}", e),
                data: None,
            });
        }
    };

    timing.lock().unwrap().record(
        "minio.put_object_content".to_string(),
        Some("MinIO operation to upload the file content".to_string()),
    );

    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Created File".to_string(),
        data: Some(CreateFileResponseBody {
            file_id: db_created_file.id.to_string(),
        }),
    })
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileRequestBody {
    pub mime_type: Option<String>,
    pub file_name: String,
    pub time_created: Option<NaiveDateTime>,
    pub time_modified: Option<NaiveDateTime>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileResponseBody {
    pub file_id: String,
}
