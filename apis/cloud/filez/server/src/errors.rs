use crate::{
    storage::errors::StorageError,
    types::{ApiResponse, ApiResponseStatus},
};
use axum::response::IntoResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::{Debug, Formatter};
use utoipa::ToSchema;

#[derive(Debug, thiserror::Error)]
pub enum FilezError {
    #[error("Database Error: {0}")]
    DatabaseError(#[from] diesel::result::Error),

    #[error("Deadpool Error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),

    #[error("Pool not initialized")]
    DatabasePoolNotInitialized,

    #[error("Url Parse Error: {0}")]
    UrlParseError(#[from] url::ParseError),

    #[error("Parse Error: {0}")]
    ParseError(String),

    #[error("Validation Error: {0}")]
    ValidationError(String),

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

    #[error("Forbidden: {0}")]
    Forbidden(String),

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

    #[error("FileVersion size exceeded: Allowed: {allowed}, Received: {received}")]
    FileVersionSizeExceeded { allowed: u64, received: u64 },

    #[error("FileVersion content digest mismatch: Expected: {expected}, Received: {received}")]
    FileVersionContentDigestMismatch { expected: String, received: String },

    #[error("FileVersion content already valid")]
    FileVersionContentAlreadyValid,

    #[error("Failed to convert BigDecimal")]
    BigDecimalSizeConversionError,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FileVersionSizeExceededErrorBody {
    pub allowed: u64,
    pub received: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FileVersionContentDigestMismatchBody {
    pub expected: String,
    pub received: String,
}

// TODO this can be improved
impl IntoResponse for FilezError {
    fn into_response(self) -> axum::response::Response {
        let (status, data, error_name) = match &self {
            FilezError::DatabaseError(ref db_error) => match db_error {
                diesel::result::Error::NotFound => (
                    axum::http::StatusCode::NOT_FOUND,
                    None,
                    "DatabaseError::NotFound".to_string(),
                ),
                _ => (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    None,
                    "DatabaseError::Other".to_string(),
                ),
            },
            FilezError::DeadpoolError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "DeadpoolError".to_string(),
            ),
            FilezError::UrlParseError(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "UrlParseError".to_string(),
            ),
            FilezError::ParseError(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "ParseError".to_string(),
            ),
            FilezError::SerdeJsonError(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "SerdeJsonError".to_string(),
            ),
            FilezError::MimeError(_) => (
                axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
                None,
                "MimeError".to_string(),
            ),
            FilezError::ResourceNotFound(_) => (
                axum::http::StatusCode::NOT_FOUND,
                None,
                "ResourceNotFound".to_string(),
            ),
            FilezError::InvalidRequest(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "InvalidRequest".to_string(),
            ),
            FilezError::UnsupportedMediaType(_) => (
                axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
                None,
                "UnsupportedMediaType".to_string(),
            ),
            FilezError::Unauthorized(_) => (
                axum::http::StatusCode::UNAUTHORIZED,
                None,
                "Unauthorized".to_string(),
            ),
            FilezError::Forbidden(_) => (
                axum::http::StatusCode::FORBIDDEN,
                None,
                "Forbidden".to_string(),
            ),
            FilezError::AuthEvaluationError(_) => (
                axum::http::StatusCode::FORBIDDEN,
                None,
                "AuthEvaluationError".to_string(),
            ),
            FilezError::StorageQuotaExceeded(_) => (
                axum::http::StatusCode::FORBIDDEN,
                None,
                "StorageQuotaExceeded".to_string(),
            ),
            FilezError::FileVersionSizeExceeded { allowed, received } => (
                axum::http::StatusCode::PAYLOAD_TOO_LARGE,
                serde_json::to_value(FileVersionSizeExceededErrorBody {
                    allowed: *allowed,
                    received: *received,
                })
                .ok(),
                "FileVersionSizeExceeded".to_string(),
            ),
            FilezError::FileVersionContentDigestMismatch { expected, received } => (
                axum::http::StatusCode::CONFLICT,
                serde_json::to_value(FileVersionContentDigestMismatchBody {
                    expected: expected.clone(),
                    received: received.clone(),
                })
                .ok(),
                "FileVersionContentDigestMismatch".to_string(),
            ),
            FilezError::FileVersionContentAlreadyValid => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "FileVersionContentAlreadyValid".to_string(),
            ),
            FilezError::BigDecimalSizeConversionError => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "BigDecimalSizeConversionError".to_string(),
            ),
            FilezError::GenericError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "GenericError".to_string(),
            ),
            FilezError::ControllerKubeError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "ControllerKubeError".to_string(),
            ),
            FilezError::ControllerFinalizerError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "ControllerFinalizerError".to_string(),
            ),
            FilezError::ControllerMissingResourceName(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "ControllerMissingResourceName".to_string(),
            ),
            FilezError::StorageError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "StorageError".to_string(),
            ),
            FilezError::IoError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "IoError".to_string(),
            ),
            FilezError::DatabasePoolNotInitialized => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "DatabasePoolNotInitialized".to_string(),
            ),
            FilezError::ResourceAuthInfoError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "ResourceAuthInfoError".to_string(),
            ),
            FilezError::ValidationError(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "ValidationError".to_string(),
            ),
        };

        let body: ApiResponse<Value> = ApiResponse {
            status: ApiResponseStatus::Error(error_name),
            message: self.to_string(),
            data,
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
