use std::collections::HashMap;

use crate::{
    controller::get_controller_health,
    errors::FilezError,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "", body = ApiResponse<HealthResBody>),
    )
)]
pub async fn get_health(
    State(ServerState {
        db,
        introspection_state,
        ..
    }): State<ServerState>,
) -> Result<impl IntoResponse, FilezError> {
    let database_health = match db.get_health().await {
        Ok(_) => HealthStatus {
            healthy: true,
            response: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            response: e.to_string(),
        },
    };

    let zitadel_health = match introspection_state.get_health().await {
        Ok(_) => HealthStatus {
            healthy: true,
            response: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            response: e.to_string(),
        },
    };

    let controller_health = match get_controller_health().await {
        Ok(_) => HealthStatus {
            healthy: true,
            response: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            response: e.to_string(),
        },
    };

    let storage_providers_health = HashMap::new();

    let all_healthy = database_health.healthy
        && zitadel_health.healthy
        && controller_health.healthy
        && storage_providers_health
            .values()
            .all(|health: &HealthStatus| health.healthy);

    return Ok((
        if all_healthy {
            StatusCode::OK
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        },
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Health check successful".to_string(),
            data: Some(HealthResBody {
                database: database_health,
                zitadel: zitadel_health,
                controller: controller_health,
                storage_providers: storage_providers_health,
            }),
        }),
    ));
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct HealthResBody {
    pub database: HealthStatus,
    pub zitadel: HealthStatus,
    pub controller: HealthStatus,
    pub storage_providers: HashMap<Uuid, HealthStatus>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct HealthStatus {
    pub healthy: bool,
    pub response: String,
}
