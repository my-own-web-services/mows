use crate::{
    http_api::authentication::user::IntrospectionGuardError,
    models::access_policies::check::AuthResult,
    storage::errors::StorageError,
    types::{ApiResponse, ApiResponseStatus},
};

use axum::response::IntoResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt::{Debug, Formatter};
use tower_sessions::session;
use utoipa::ToSchema;

#[derive(Debug, thiserror::Error)]
pub enum FilezError {
    #[error("Session Error: {0}")]
    SessionError(#[from] session::Error),

    #[error("JSON Rejection Error: {0}")]
    JsonRejectionError(#[from] axum::extract::rejection::JsonRejection),

    #[error("Validation Error: {0}")]
    ValidationError(#[from] serde_valid::validation::Errors),

    #[error("Failed to convert number: {0}")]
    TryFromIntError(#[from] std::num::TryFromIntError),

    #[error("Database Error: {0}")]
    DatabaseError(#[from] diesel::result::Error),

    #[error(transparent)]
    IntrospectionGuardError(#[from] IntrospectionGuardError),

    #[error("Deadpool Error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),

    #[error("Pool not initialized")]
    DatabasePoolNotInitialized,

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

    #[error("Auth engine error: {0}")]
    AuthCoreError(#[from] mows_auth_core::types::AuthError),

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

    #[error("{0}")]
    AuthEvaluationAccessDenied(AuthResult),

    #[error("Kube Error: {0}")]
    ControllerKubeError(#[from] kube::Error),

    #[error("Finalizer Error: {0}")]
    ControllerFinalizerError(#[from] Box<kube::runtime::finalizer::Error<FilezError>>),

    #[error("Missing resource name: {0}")]
    ControllerMissingResourceName(String),

    #[error("Storage quota {quota_label} exceeded by {request_over_quota_bytes}.\n{quota_used_bytes}/{quota_allowed_bytes} bytes of quota used.\nRequested size was {requested_bytes} bytes.")]
    StorageQuotaExceeded {
        quota_label: String,
        quota_allowed_bytes: u64,
        quota_used_bytes: u64,
        requested_bytes: u64,
        request_over_quota_bytes: u64,
    },

    #[error("FileVersion size exceeded: Allowed: {allowed}, Received: {received}")]
    FileVersionSizeExceeded { allowed: u64, received: u64 },

    #[error("FileVersion content digest mismatch: Expected: {expected}, Received: {received}")]
    FileVersionContentDigestMismatch { expected: String, received: String },

    #[error("FileVersion content already valid")]
    FileVersionContentAlreadyValid,
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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StorageQuotaExceededBody {
    pub quota_label: String,
    pub quota_allowed_bytes: u64,
    pub quota_used_bytes: u64,
    pub requested_bytes: u64,
    pub request_over_quota_bytes: u64,
}

// TODO this can be improved
impl IntoResponse for FilezError {
    #[tracing::instrument(level = "trace")]
    fn into_response(self) -> axum::response::Response {
        let (status, data, error_name) = match &self {
            FilezError::TryFromIntError(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "TryFromIntError".to_string(),
            ),
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
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "AuthEvaluationError".to_string(),
            ),
            FilezError::AuthCoreError(auth_core_error) => {
                let status = match auth_core_error {
                    mows_auth_core::types::AuthError::Denied => {
                        axum::http::StatusCode::FORBIDDEN
                    }
                    _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                };
                (status, None, "AuthCoreError".to_string())
            }
            FilezError::AuthEvaluationAccessDenied(auth_result) => (
                axum::http::StatusCode::FORBIDDEN,
                serde_json::to_value(auth_result).ok(),
                "AuthEvaluationAccessDenied".to_string(),
            ),
            FilezError::StorageQuotaExceeded {
                quota_label,
                quota_allowed_bytes,
                quota_used_bytes,
                requested_bytes,
                request_over_quota_bytes,
            } => (
                axum::http::StatusCode::FORBIDDEN,
                serde_json::to_value(StorageQuotaExceededBody {
                    quota_label: quota_label.clone(),
                    quota_allowed_bytes: *quota_allowed_bytes,
                    quota_used_bytes: *quota_used_bytes,
                    requested_bytes: *requested_bytes,
                    request_over_quota_bytes: *request_over_quota_bytes,
                })
                .ok(),
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
            FilezError::SessionError(_) => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                None,
                "SessionError".to_string(),
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

            FilezError::ValidationError(e) => (
                axum::http::StatusCode::BAD_REQUEST,
                serde_json::to_value(e).ok(),
                "ValidationError".to_string(),
            ),
            FilezError::JsonRejectionError(_) => (
                axum::http::StatusCode::BAD_REQUEST,
                None,
                "JsonRejectionError".to_string(),
            ),
            FilezError::IntrospectionGuardError(introspection_guard_error) => {
                match introspection_guard_error {
                    IntrospectionGuardError::Inactive => (
                        axum::http::StatusCode::UNAUTHORIZED,
                        None,
                        "IntrospectionGuardError::Inactive".to_string(),
                    ),
                    _ => (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        None,
                        "IntrospectionGuardError::Other".to_string(),
                    ),
                }
            }
        };

        // Log the full error chain server-side. Body sees the
        // sanitized form only — see `safe_message` below.
        tracing::error!(error = ?self, "FilezError → HTTP {}", status);

        let body: ApiResponse<Value> = ApiResponse {
            status: ApiResponseStatus::Error(error_name),
            message: self.safe_message(),
            data,
        };
        (status, axum::Json(body)).into_response()
    }
}

impl FilezError {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }

    /// Body-safe error message. Variants that wrap internal error types
    /// (`diesel::result::Error`, pool errors, Kubernetes API errors,
    /// `anyhow::Error`, `IoError`, …) leak column names / constraint
    /// names / pool state / paths through `Display`. SEC-1 fix: those
    /// variants get a fixed generic string; the full chain is logged
    /// to tracing for ops, never to the HTTP body.
    ///
    /// Variants whose `Display` is genuinely user-facing (user-supplied
    /// validation errors, "Forbidden: <reason>", quota messages, …)
    /// keep `self.to_string()`.
    fn safe_message(&self) -> String {
        match self {
            // --- redacted: wraps diesel / pool / anyhow / kube / io ---
            FilezError::DatabaseError(_) => "database error".to_string(),
            FilezError::DeadpoolError(_) => "database pool error".to_string(),
            FilezError::AuthCoreError(_) => "authorization engine error".to_string(),
            FilezError::IoError(_) => "io error".to_string(),
            FilezError::GenericError(_) => "internal error".to_string(),
            FilezError::StorageError(_) => "storage error".to_string(),
            FilezError::IntrospectionGuardError(_) => "authentication error".to_string(),
            FilezError::ControllerKubeError(_)
            | FilezError::ControllerFinalizerError(_)
            | FilezError::ControllerMissingResourceName(_) => "controller error".to_string(),
            FilezError::SessionError(_) => "session error".to_string(),
            FilezError::DatabasePoolNotInitialized => "database pool not initialized".to_string(),
            FilezError::AuthEvaluationError(_) => "auth evaluation error".to_string(),
            // --- safe: user input / static strings / typed data ---
            FilezError::TryFromIntError(_)
            | FilezError::JsonRejectionError(_)
            | FilezError::ValidationError(_)
            | FilezError::UrlParseError(_)
            | FilezError::ParseError(_)
            | FilezError::SerdeJsonError(_)
            | FilezError::MimeError(_)
            | FilezError::ResourceNotFound(_)
            | FilezError::InvalidRequest(_)
            | FilezError::UnsupportedMediaType(_)
            | FilezError::Unauthorized(_)
            | FilezError::Forbidden(_)
            | FilezError::ResourceAuthInfoError(_)
            | FilezError::AuthEvaluationAccessDenied(_)
            | FilezError::StorageQuotaExceeded { .. }
            | FilezError::FileVersionSizeExceeded { .. }
            | FilezError::FileVersionContentDigestMismatch { .. }
            | FilezError::FileVersionContentAlreadyValid => self.to_string(),
        }
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

#[cfg(test)]
mod safe_message_redaction {
    //! SEC-1 regression guard. Variants that wrap internal error types
    //! must never put `self.to_string()` (which includes the wrapped
    //! Display chain) into the HTTP body — that leaks column names,
    //! constraint names, pool state, paths, etc. The full chain still
    //! goes to tracing::error for ops.
    use super::*;

    #[test]
    fn database_error_message_is_redacted() {
        // diesel::result::Error::NotFound has a Display like "Record not
        // found" — innocuous, but other variants reveal column names
        // and constraint values. We blanket-redact the whole variant.
        let err = FilezError::DatabaseError(diesel::result::Error::NotFound);
        let msg = err.safe_message();
        assert_eq!(msg, "database error");
        assert!(
            !msg.contains("NotFound"),
            "DatabaseError safe_message must not leak the diesel variant: {msg}"
        );
    }

    #[test]
    fn auth_core_error_message_is_redacted() {
        // AuthError::Database wraps a diesel error which in turn wraps
        // a Postgres error containing column names, constraints, etc.
        let err = FilezError::AuthCoreError(mows_auth_core::types::AuthError::Database(
            diesel::result::Error::NotFound,
        ));
        let msg = err.safe_message();
        assert_eq!(msg, "authorization engine error");
        assert!(
            !msg.contains("NotFound") && !msg.contains("database"),
            "AuthCoreError safe_message must not leak the underlying chain: {msg}"
        );
    }

    #[test]
    fn forbidden_message_passes_through() {
        // Forbidden carries a user-facing reason; it's intentional.
        let err = FilezError::Forbidden("you cannot delete this file".to_string());
        let msg = err.safe_message();
        assert!(
            msg.contains("you cannot delete this file"),
            "Forbidden message must surface the explicit reason: {msg}"
        );
    }

    #[test]
    fn resource_not_found_message_passes_through() {
        let err = FilezError::ResourceNotFound("file abc-123".to_string());
        let msg = err.safe_message();
        assert!(
            msg.contains("file abc-123"),
            "ResourceNotFound must surface the resource id: {msg}"
        );
    }
}
