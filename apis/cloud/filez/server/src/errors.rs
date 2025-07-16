use std::fmt::{Debug, Formatter};

use axum::response::IntoResponse;

use crate::{
    storage::errors::StorageError,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
};

#[derive(Debug, thiserror::Error)]
pub enum FilezError {
    #[error("Database Error: {0}")]
    DatabaseError(#[from] diesel::result::Error),

    #[error("Deadpool Error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),

    #[error("Url Parse Error: {0}")]
    UrlParseError(#[from] url::ParseError),

    #[error("Parse Error: {0}")]
    ParseError(String),

    #[error("Serde JSON Error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),

    #[error("Mime Error: {0}")]
    MimeError(#[from] mime_guess::mime::FromStrError),

    #[error("Generic Error: {0}")]
    GenericError(#[from] anyhow::Error),

    #[error("Resource not found: {0}")]
    ResourceNotFound(String),

    #[error("IO Error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Storage Error: {0}")]
    StorageError(#[from] StorageError),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Unsupported media type: {0}")]
    UnsupportedMediaType(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Unsupported resource type: {0}")]
    ResourceAuthInfoError(String),

    #[error("Auth evaluation error: {0}")]
    AuthEvaluationError(String),

    #[error("Kube Error: {0}")]
    ControllerKubeError(#[from] kube::Error),

    #[error("Finalizer Error: {0}")]
    ControllerFinalizerError(#[from] Box<kube::runtime::finalizer::Error<FilezError>>),

    #[error("Missing resource name: {0}")]
    ControllerMissingResourceName(String),

    #[error("Storage quota exceeded: {0}")]
    StorageQuotaExceeded(String),
}

impl IntoResponse for FilezError {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            FilezError::DatabaseError(ref db_error) => match db_error {
                diesel::result::Error::NotFound => axum::http::StatusCode::NOT_FOUND,
                _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            },
            FilezError::DeadpoolError(_) => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            FilezError::UrlParseError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::ParseError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::SerdeJsonError(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::MimeError(_) => axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            FilezError::ResourceNotFound(_) => axum::http::StatusCode::NOT_FOUND,
            FilezError::InvalidRequest(_) => axum::http::StatusCode::BAD_REQUEST,
            FilezError::UnsupportedMediaType(_) => axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            FilezError::Unauthorized(_) => axum::http::StatusCode::UNAUTHORIZED,
            FilezError::AuthEvaluationError(_) => axum::http::StatusCode::UNAUTHORIZED,
            FilezError::StorageQuotaExceeded(_) => axum::http::StatusCode::PAYLOAD_TOO_LARGE,
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

impl FilezError {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

struct TypedDebugWrapper<'a, T: ?Sized>(&'a T);

impl<T: Debug> Debug for TypedDebugWrapper<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}::{:?}", core::any::type_name::<T>(), self.0)
    }
}

trait TypedDebug: Debug {
    fn typed_debug(&self) -> TypedDebugWrapper<'_, Self> {
        TypedDebugWrapper(self)
    }
}

impl<T: ?Sized + Debug> TypedDebug for T {}

pub fn get_error_type(e: &FilezError) -> String {
    let reason = format!("{:?}", e.typed_debug());
    let reason = reason.split_at(reason.find('(').unwrap_or(0)).0;
    reason.to_string()
}
