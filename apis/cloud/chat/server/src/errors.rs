//! Typed errors for the chat service.
//!
//! Mirrors `filez-server`'s pattern: one top-level error enum that
//! implements `axum::response::IntoResponse` so handlers can `?`
//! everything and the right HTTP status comes out automatically.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use thiserror::Error;

use crate::types::{ApiResponse, ApiResponseStatus, EmptyApiResponse};

#[derive(Debug, Error)]
pub enum ChatError {
    #[error("database pool not initialized")]
    DatabasePoolNotInitialized,

    #[error("diesel error: {0}")]
    DieselError(#[from] diesel::result::Error),

    #[error("diesel connection error: {0}")]
    DieselConnectionError(#[from] diesel::ConnectionError),

    #[error("deadpool error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),

    #[error("auth-core error: {0}")]
    AuthCoreError(#[from] mows_auth_core::AuthError),

    #[error("serde error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),

    #[error("anyhow error: {0}")]
    AnyhowError(#[from] anyhow::Error),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),
}

impl IntoResponse for ChatError {
    fn into_response(self) -> Response {
        let status = match &self {
            ChatError::NotFound(_) => StatusCode::NOT_FOUND,
            ChatError::Forbidden(_) => StatusCode::FORBIDDEN,
            ChatError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ChatError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let body: ApiResponse<EmptyApiResponse> = ApiResponse {
            status: ApiResponseStatus::Error(discriminator(&self).to_string()),
            message: self.to_string(),
            data: None,
        };
        (status, Json(body)).into_response()
    }
}

/// Stable snake_case string for the error variant. Used by clients
/// as a programmatic discriminator without coupling them to the
/// HTTP status code.
fn discriminator(e: &ChatError) -> &'static str {
    match e {
        ChatError::DatabasePoolNotInitialized => "database_pool_not_initialized",
        ChatError::DieselError(_) => "database_error",
        ChatError::DieselConnectionError(_) => "database_connection_error",
        ChatError::DeadpoolError(_) => "database_pool_error",
        ChatError::AuthCoreError(_) => "auth_core_error",
        ChatError::SerdeJsonError(_) => "serde_error",
        ChatError::AnyhowError(_) => "internal_error",
        ChatError::NotFound(_) => "not_found",
        ChatError::Forbidden(_) => "forbidden",
        ChatError::BadRequest(_) => "bad_request",
        ChatError::Unauthorized(_) => "unauthorized",
    }
}
