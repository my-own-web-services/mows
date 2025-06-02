use std::str::FromStr;

use axum::{
    extract::{Request, State},
    http::HeaderMap,
    Json,
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
    models::NewFile,
    types::{ApiResponse, ApiResponseStatus, AppState},
    validation::validate_file_name,
};

#[utoipa::path(
    post,
    path = "/api/files/create",
    responses(
        (status = 200, description = "Created a file on the server", body = ApiResponse<CreateFileResponseBody>),
    )
)]
pub async fn create(
    external_user: IntrospectedUser,
    headers: HeaderMap,
    State(app_state): State<AppState>,
    request: Request,
) -> Json<ApiResponse<CreateFileResponseBody>> {
    // Check if the user is authenticated

    let user = match app_state
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

    let content_length = request
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok());

    if content_length.is_none() {
        return Json(ApiResponse {
            status: ApiResponseStatus::Error,
            message: "Content-Length header is missing".to_string(),
            data: None,
        });
    }

    let meta_body: CreateFileRequestBody =
        match serde_json::from_str(&headers.get("body").unwrap().to_str().unwrap()) {
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

    // Create a new file entry in the database
    let new_file = NewFile {
        owner_id: user.user_id,
        mime_type: &mime_type.to_string(),
        file_name: &meta_body.file_name,
        created_time: meta_body
            .time_created
            .unwrap_or_else(|| chrono::Utc::now().naive_utc()),
        modified_time: meta_body
            .time_modified
            .unwrap_or_else(|| chrono::Utc::now().naive_utc()),
    };

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

    let stream = request
        .into_body()
        .into_data_stream()
        .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

    let object_content = ObjectContent::new_from_stream(stream, content_length);

    match app_state
        .minio_client
        .put_object_content(BUCKET_NAME, db_created_file.file_id, object_content)
        .content_type(mime_type.to_string())
        .send()
        .await
    {
        Ok(_) => {}
        Err(e) => {
            // If the file upload fails, delete the file entry from the database
            if let Err(db_error) = app_state.db.delete_file(db_created_file.file_id).await {
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

    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Created File".to_string(),
        data: Some(CreateFileResponseBody {
            file_id: db_created_file.file_id.to_string(),
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
