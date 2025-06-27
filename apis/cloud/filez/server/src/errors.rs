use axum::response::IntoResponse;

use crate::{
    storage::errors::StorageError,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};

#[derive(Debug, thiserror::Error)]
pub enum FilezError {
    #[error(transparent)]
    DatabaseError(#[from] diesel::result::Error),
    #[error(transparent)]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error("Auth Evaluation Error: {0}")]
    AuthEvaluationError(String),
    #[error(transparent)]
    UrlParseError(#[from] url::ParseError),
    #[error("Parse Error: {0}")]
    ParseError(String),
    #[error(transparent)]
    SerdeJsonError(#[from] serde_json::Error),
    #[error(transparent)]
    MimeError(#[from] mime_guess::mime::FromStrError),
    #[error(transparent)]
    GenericError(#[from] anyhow::Error),
    #[error("Resource not found: {0}")]
    ResourceNotFound(String),
    #[error("IO Error: {0}")]
    IoError(#[from] std::io::Error),
    #[error(transparent)]
    StorageError(#[from] StorageError),
    // invalid request
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    // unsupported media type
    #[error("Unsupported media type: {0}")]
    UnsupportedMediaType(String),
    // unauthorized
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
}

impl IntoResponse for FilezError {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            FilezError::DatabaseError(_) | FilezError::DeadpoolError(_) => {
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            }
            FilezError::AuthEvaluationError(_) => axum::http::StatusCode::UNAUTHORIZED,
            FilezError::UrlParseError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::ParseError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::SerdeJsonError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::MimeError(_) => axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            FilezError::GenericError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            FilezError::ResourceNotFound(_) => axum::http::StatusCode::NOT_FOUND,
            FilezError::IoError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            FilezError::StorageError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            FilezError::InvalidRequest(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::UnsupportedMediaType(_) => axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            FilezError::Unauthorized(_) => axum::http::StatusCode::UNAUTHORIZED,
        };

        let body: ApiResponse<EmptyApiResponse> = ApiResponse {
            status: ApiResponseStatus::Error,
            message: self.to_string(),
            data: None,
        };
        (status, axum::Json(body)).into_response()
    }
}
