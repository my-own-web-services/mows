//! Minimal liveness + readiness check.
//!
//! Round 1: returns `ok` unconditionally. Round 2 wires a
//! database ping so readiness probes can drive autoscaling.

use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

use crate::types::{ApiResponse, ApiResponseStatus};

#[derive(Serialize, ToSchema, Debug, Clone)]
pub struct HealthStatus {
    pub ok: bool,
}

#[utoipa::path(
    get,
    path = "/api/health",
    description = "Liveness check — returns ok if the process is reachable.",
    responses(
        (status = 200, description = "OK", body = ApiResponse<HealthStatus>)
    )
)]
pub async fn health() -> Json<ApiResponse<HealthStatus>> {
    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "ok".to_string(),
        data: Some(HealthStatus { ok: true }),
    })
}
