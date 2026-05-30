use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use thiserror::Error;

use crate::types::{ApiResponse, ApiResponseStatus};

#[derive(Debug, Error)]
pub enum AuthzAdminError {
    #[error("upstream error: {0}")]
    Upstream(String),
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AuthzAdminError {
    fn into_response(self) -> Response {
        let (status, kind) = match &self {
            AuthzAdminError::Upstream(_) => (StatusCode::BAD_GATEWAY, "Upstream"),
            AuthzAdminError::BadRequest(_) => (StatusCode::BAD_REQUEST, "BadRequest"),
            AuthzAdminError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "Unauthorized"),
            AuthzAdminError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal"),
        };
        let body = ApiResponse::<()> {
            status: ApiResponseStatus::Error(kind.to_string()),
            message: self.to_string(),
            data: None,
        };
        (status, axum::Json(body)).into_response()
    }
}

impl From<reqwest::Error> for AuthzAdminError {
    fn from(e: reqwest::Error) -> Self {
        AuthzAdminError::Upstream(e.to_string())
    }
}
