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

    /// External `ssh` / `ssh-keygen` / `tmux`-over-ssh process failure.
    /// Mapped to 500 with a redacted public message ("upstream ssh
    /// failed") so the caller doesn't see raw stderr.
    #[error("ssh failure: {0}")]
    SshFailed(String),

    /// `PortAllocator` ran out of free ports in the configured range.
    /// 503 — recoverable in principle (widen `port_range`); not the
    /// caller's fault.
    #[error("port range exhausted: {0}")]
    PortExhausted(String),

    /// Newly-created VM never presented an SSH banner inside the
    /// readiness deadline. 504 (Gateway Timeout) — the supervisor
    /// itself is healthy; the guest didn't come up in time.
    #[error("vm boot timeout: {0}")]
    VmBootTimeout(String),

    /// Local filesystem op failed with a path-bearing message. Keeps
    /// the path out of the public response body (so absolute paths
    /// don't leak to API clients) while making the operator log
    /// useful.
    #[error("filesystem: {0}")]
    FilesystemError(String),

    /// Last-resort variant for truly unexpected conditions. Prefer the
    /// typed variants above for anything classifiable — `Internal` is
    /// reserved for "the operator needs to see this in the log, the
    /// caller gets a redacted 500." All current production callsites
    /// went through SLOP-46's typed-error sweep; new code should follow
    /// suit.
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
            Self::SshFailed(msg) => {
                // ssh stderr can carry hostnames + key paths; log it for
                // the operator but keep the public body redacted.
                tracing::error!(error = %msg, "ssh failure");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "upstream ssh failed".to_string(),
                )
            }
            Self::PortExhausted(msg) => (
                StatusCode::SERVICE_UNAVAILABLE,
                format!("port range exhausted: {msg}"),
            ),
            Self::VmBootTimeout(msg) => (
                StatusCode::GATEWAY_TIMEOUT,
                format!("vm boot timeout: {msg}"),
            ),
            Self::FilesystemError(msg) => {
                tracing::error!(error = %msg, "filesystem error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "filesystem error".to_string(),
                )
            }
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
