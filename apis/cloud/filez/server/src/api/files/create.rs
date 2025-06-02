use std::str::FromStr;

use axum::{
    extract::{Request, State},
    http::HeaderMap,
    Json,
};
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
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
    user: IntrospectedUser,
    headers: HeaderMap,
    State(app_state): State<AppState>,
    request: Request,
) -> Json<ApiResponse<CreateFileResponseBody>> {
    // Check if the user is authenticated

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

    let mime_type = match Mime::from_str(&meta_body.mime_type) {
        Ok(mime) => mime,
        Err(e) => {
            return Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: format!("Invalid MIME type: {}", e),
                data: None,
            });
        }
    };

    if let Err(e) = validate_file_name(&meta_body.file_name).await {
        return Json(ApiResponse {
            status: ApiResponseStatus::Error,
            message: format!("Invalid file name: {}", e),
            data: None,
        });
    }

    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Created File".to_string(),
        data: Some(CreateFileResponseBody {
            file_id: "".to_string(), // This should be replaced with the actual file ID after creation,
        }),
    })
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileRequestBody {
    pub mime_type: String,
    pub file_name: String,
    pub time_created: Option<i64>,
    pub time_modified: Option<i64>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileResponseBody {
    pub file_id: String,
}
