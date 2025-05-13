use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::types::{ApiResponse, ApiResponseStatus};

#[utoipa::path(
        get,
        path = "/api/health",
        responses(
            (status = 200, description = "Got health", body = ApiResponse<HealthResBody>),
        )
    )]
pub async fn get_health() -> Json<ApiResponse<HealthResBody>> {
    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Package Manager is healthy".to_string(),
        data: Some(HealthResBody {}),
    })
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct HealthResBody {}
