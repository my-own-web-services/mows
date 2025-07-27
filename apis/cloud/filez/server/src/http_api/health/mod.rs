use std::collections::HashMap;

use crate::{
    controller::get_controller_health,
    errors::FilezError,
    models::storage_locations::StorageLocation,
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
        (status = 200, description = "Service healthy", body = ApiResponse<HealthResBody>),
        (status = 503, description = "Service unavailable", body = ApiResponse<HealthResBody>),
    )
)]
pub async fn get_health(
    State(ServerState {
        database,
        introspection_state,
        storage_location_providers,
        ..
    }): State<ServerState>,
) -> Result<impl IntoResponse, FilezError> {
    let (
        database_health_future,
        zitadel_health_future,
        controller_health_future,
        storage_locations_health_future,
    ) = (
        database.get_health(),
        introspection_state.get_health(),
        get_controller_health(),
        StorageLocation::get_all_storage_locations_health(&storage_location_providers),
    );

    let (database_health, zitadel_health, controller_health, storage_locations_health) = tokio::join!(
        database_health_future,
        zitadel_health_future,
        controller_health_future,
        storage_locations_health_future
    );

    let database_health = match database_health {
        Ok(_) => HealthStatus {
            healthy: true,
            response: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            response: e.to_string(),
        },
    };

    let zitadel_health = match zitadel_health {
        Ok(_) => HealthStatus {
            healthy: true,
            response: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            response: e.to_string(),
        },
    };

    let controller_health = match controller_health {
        Ok(_) => HealthStatus {
            healthy: true,
            response: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            response: e.to_string(),
        },
    };

    let all_healthy = database_health.healthy
        && zitadel_health.healthy
        && controller_health.healthy
        && storage_locations_health
            .values()
            .all(|health: &HealthStatus| health.healthy);

    return Ok((
        if all_healthy {
            StatusCode::OK
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        },
        Json(ApiResponse {
            status: ApiResponseStatus::Success{},
            message: "Health check successful".to_string(),
            data: Some(HealthResBody {
                all_healthy,
                database: database_health,
                zitadel: zitadel_health,
                controller: controller_health,
                storage_locations: storage_locations_health,
            }),
        }),
    ));
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct HealthResBody {
    pub all_healthy: bool,
    pub database: HealthStatus,
    pub zitadel: HealthStatus,
    pub controller: HealthStatus,
    pub storage_locations: HashMap<Uuid, HealthStatus>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct HealthStatus {
    pub healthy: bool,
    pub response: String,
}
