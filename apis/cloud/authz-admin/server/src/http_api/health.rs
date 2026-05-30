use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

use crate::types::{ApiResponse, ApiResponseStatus};

#[derive(Serialize, ToSchema, Debug)]
pub struct HealthResponse {
    pub status: &'static str,
}

#[utoipa::path(
    get,
    path = "/api/health",
    description = "Process liveness probe. Returns 200 once axum is serving — does NOT verify upstream reachability (that's `/api/upstreams`).",
    responses((status = 200, body = ApiResponse<HealthResponse>))
)]
pub async fn health() -> Json<ApiResponse<HealthResponse>> {
    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "ok".to_string(),
        data: Some(HealthResponse { status: "ok" }),
    })
}
