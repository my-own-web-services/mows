use axum::response::IntoResponse;

use crate::{
    models::apps::errors::MowsAppError,
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
    #[error(" MowsApp Error: {0}")]
    MowsAppError(#[from] MowsAppError),
    #[error("FileVersion Error: {0}")]
    FileVersionError(#[from] crate::models::file_versions::errors::FileVersionError),
    #[error("FilezFile Error: {0}")]
    FilezFileError(#[from] crate::models::files::errors::FilezFileError),
    #[error("FilezUser Error: {0}")]
    FilezUserError(#[from] crate::models::users::errors::FilezUserError),
    #[error("StorageLocation Error: {0}")]
    StorageLocationError(#[from] crate::models::storage_locations::errors::StorageLocationError),
    #[error("FileGroup Error: {0}")]
    FileGroupError(#[from] crate::models::file_groups::errors::FileGroupError),
    #[error("FilezTag Error: {0}")]
    FilezTagError(#[from] crate::models::tags::errors::FilezTagError),
    #[error("UserGroup Error: {0}")]
    UserGroupError(#[from] crate::models::user_groups::errors::UserGroupError),
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
            FilezError::ResourceNotFound(_) => axum::http::StatusCode::NOT_FOUND,
            FilezError::InvalidRequest(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::UnsupportedMediaType(_) => axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            FilezError::Unauthorized(_) => axum::http::StatusCode::UNAUTHORIZED,
            _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body: ApiResponse<EmptyApiResponse> = ApiResponse {
            status: ApiResponseStatus::Error,
            message: self.to_string(),
            data: None,
        };
        (status, axum::Json(body)).into_response()
    }
}
