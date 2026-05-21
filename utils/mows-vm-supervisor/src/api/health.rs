use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::state::SharedState;

pub fn rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new().routes(routes!(healthz))
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

#[utoipa::path(
    get,
    path = "/v1/healthz",
    tag = "health",
    description = "Liveness probe. Always 200 if the process is up.",
    responses(
        (status = 200, description = "Service info", body = HealthResponse),
    )
)]
async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        service: "mows-vm-supervisor".into(),
        version: env!("CARGO_PKG_VERSION").into(),
    })
}
