use crate::{
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
};
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "", body = ApiResponse<HealthResBody>),
    )
)]
pub async fn get_health(
    State(ServerState { .. }): State<ServerState>,
) -> Json<ApiResponse<HealthResBody>> {
    return Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "".to_string(),
        data: Some(HealthResBody {}),
    });
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct HealthResBody {}
