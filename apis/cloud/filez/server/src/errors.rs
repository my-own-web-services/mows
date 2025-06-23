use axum::response::IntoResponse;

use crate::types::{ApiResponse, ApiResponseStatus, EmptyApiResponse};

#[derive(Debug, thiserror::Error)]

pub enum FilezErrors {
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
    // not found
    #[error("Resource not found: {0}")]
    ResourceNotFound(String),
    // minio errors
    #[error(transparent)]
    MinioError(#[from] minio::s3::error::Error),
    // io error
    #[error("IO Error: {0}")]
    IoError(#[from] std::io::Error),
}

impl IntoResponse for FilezErrors {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            FilezErrors::DatabaseError(_) | FilezErrors::DeadpoolError(_) => {
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            }
            FilezErrors::AuthEvaluationError(_) => axum::http::StatusCode::UNAUTHORIZED,
            FilezErrors::UrlParseError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezErrors::ParseError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezErrors::SerdeJsonError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezErrors::MimeError(_) => axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            FilezErrors::GenericError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            FilezErrors::ResourceNotFound(_) => axum::http::StatusCode::NOT_FOUND,
            FilezErrors::MinioError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            FilezErrors::IoError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body: ApiResponse<EmptyApiResponse> = ApiResponse {
            status: ApiResponseStatus::Error,
            message: self.to_string(),
            data: None,
        };
        (status, axum::Json(body)).into_response()
    }
}
