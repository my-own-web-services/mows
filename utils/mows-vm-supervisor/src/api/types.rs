//! Shared DTOs referenced from multiple `#[utoipa::path]` annotations.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Error body returned from every fallible endpoint. Matches
/// `SupervisorError::into_response` in `crate::error`.
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ErrorResponse {
    /// Public, user-safe error description.
    pub error: String,
}

/// Response body for a successful lifecycle mutation on a VM or agent.
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct OperationResult {
    /// Id of the affected resource.
    pub id: String,
    /// New status, if the operation transitions one (e.g. "stopped").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    /// `true` if the resource was deleted.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

impl OperationResult {
    pub fn status(id: impl Into<String>, status: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            status: Some(status.into()),
            deleted: None,
        }
    }

    pub fn deleted(id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            status: None,
            deleted: Some(true),
        }
    }
}
