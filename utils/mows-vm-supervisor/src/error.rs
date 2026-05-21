use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use thiserror::Error;

use crate::api::types::ErrorResponse;

pub type Result<T> = std::result::Result<T, SupervisorError>;

#[derive(Debug, Error)]
pub enum SupervisorError {
    #[error("config error: {0}")]
    Config(String),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("database: {0}")]
    Database(#[from] sqlx::Error),

    #[error("migration: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("yaml: {0}")]
    Yaml(#[from] serde_yaml_neo::Error),

    #[error("password hashing: {0}")]
    PasswordHash(String),

    #[error("authentication failed")]
    Unauthorized,

    #[error("forbidden")]
    Forbidden,

    #[error("not found: {0}")]
    NotFound(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("kvm not available: {0}")]
    KvmUnavailable(String),

    #[error("qemu spawn: {0}")]
    QemuSpawn(String),

    #[error("agent kind {0:?} not registered")]
    UnknownKind(String),

    #[error("guest image not available: {0}")]
    ImageMissing(String),

    #[error("invalid state: {0}")]
    InvalidState(String),

    #[error("internal: {0}")]
    Internal(String),
}

impl From<argon2::password_hash::Error> for SupervisorError {
    fn from(value: argon2::password_hash::Error) -> Self {
        Self::PasswordHash(value.to_string())
    }
}

impl IntoResponse for SupervisorError {
    fn into_response(self) -> Response {
        let (status, public_message) = match &self {
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized".to_string()),
            Self::Forbidden => (StatusCode::FORBIDDEN, "forbidden".to_string()),
            Self::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            Self::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            Self::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            Self::KvmUnavailable(msg) => (
                StatusCode::SERVICE_UNAVAILABLE,
                format!("kvm not available: {msg}"),
            ),
            Self::UnknownKind(kind) => (
                StatusCode::BAD_REQUEST,
                format!("unknown agent kind: {kind}"),
            ),
            Self::ImageMissing(msg) => (
                StatusCode::SERVICE_UNAVAILABLE,
                format!("guest image not available: {msg}"),
            ),
            Self::InvalidState(msg) => {
                // Surface this loudly — it means a row in the DB violated an
                // invariant the supervisor relies on. Caller sees 500 but the
                // operator's log makes the corruption obvious.
                tracing::error!(error = %msg, "invalid supervisor state");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("invalid state: {msg}"),
                )
            }
            Self::QemuSpawn(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("qemu spawn failed: {msg}"),
            ),
            other => {
                tracing::error!(error = ?other, "internal supervisor error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".to_string(),
                )
            }
        };
        // Use the typed `ErrorResponse` DTO so the runtime response and
        // the OpenAPI schema can't drift apart silently (TECH-RUST-5).
        let body = axum::Json(ErrorResponse {
            error: public_message,
        });
        (status, body).into_response()
    }
}
