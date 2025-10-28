use std::collections::HashMap;

use crate::{
    database::DatabaseHealthDetails,
    errors::FilezError,
    kubernetes_controller::{get_controller_health_with_state, ControllerHealthDetails},
    models::storage_locations::{StorageLocation, StorageLocationId},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
};
use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::{IntoParams, ToSchema};

#[derive(Deserialize, IntoParams, Debug)]
pub struct HealthQueryParams {
    #[serde(default = "default_pretty")]
    #[param(default = true)]
    pretty: bool,
}

fn default_pretty() -> bool {
    true
}

#[utoipa::path(
    get,
    path = "/api/health",
    description = "Get the health status of the service",
    params(
        HealthQueryParams
    ),
    responses(
        (
            status = 200,
            description = "Service healthy",
            body = ApiResponse<HealthResBody>
        ),
        (
            status = 503,
            description = "Service unavailable",
            body = ApiResponse<HealthResBody>
        ),
    )
)]
#[tracing::instrument(skip(database), level = "trace")]
pub async fn get_health(
    Query(params): Query<HealthQueryParams>,
    State(ServerState {
        database,
        introspection_state,
        controller_state,
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
        get_controller_health_with_state(&controller_state),
        StorageLocation::get_all_storage_locations_health(&storage_location_providers),
    );

    let (database_health, zitadel_health, controller_health, storage_locations_health) = tokio::join!(
        database_health_future,
        zitadel_health_future,
        controller_health_future,
        storage_locations_health_future
    );

    let database_health = match database_health {
        Ok(details) => {
            let is_healthy = details.reachable && details.error.is_none();

            let mut message_parts = Vec::new();

            if !details.reachable {
                message_parts.push("Database unreachable".to_string());
            } else {
                if let Some(latency) = details.latency_ms {
                    message_parts.push(format!("Latency: {}ms", latency));
                }

                if let Some(pool) = &details.pool_status {
                    message_parts.push(format!(
                        "Pool: {}/{} connections available",
                        pool.available, pool.max_size
                    ));
                }

                if let Some(conn_count) = details.connection_count {
                    if let Some(max_conn) = details.max_connections {
                        message_parts.push(format!("Connections: {}/{}", conn_count, max_conn));
                    }
                }
            }

            if let Some(error) = &details.error {
                message_parts.push(format!("Error: {}", error));
            }

            DatabaseHealthStatus {
                healthy: is_healthy,
                message: if message_parts.is_empty() {
                    "Healthy".to_string()
                } else {
                    message_parts.join("; ")
                },
                details: Some(details),
            }
        }
        Err(e) => DatabaseHealthStatus {
            healthy: false,
            message: format!("Database health check failed: {}", e),
            details: None,
        },
    };

    let zitadel_health = match zitadel_health {
        Ok(_) => HealthStatus {
            healthy: true,
            message: "Healthy".to_string(),
        },
        Err(e) => HealthStatus {
            healthy: false,
            message: e.to_string(),
        },
    };

    let controller_health = match controller_health {
        Ok(details) => {
            let is_healthy = details.kubernetes_reachable
                && details.crd_installed
                && details.reconcile_loop_running;

            let mut response_parts = Vec::new();

            if !details.kubernetes_reachable {
                response_parts.push(format!(
                    "Kubernetes unreachable: {}",
                    details
                        .kubernetes_error
                        .as_deref()
                        .unwrap_or("Unknown error")
                ));
            } else {
                response_parts.push("Kubernetes reachable".to_string());
            }

            if !details.crd_installed {
                response_parts.push(format!(
                    "CRD not installed: {}",
                    details.crd_error.as_deref().unwrap_or("Unknown error")
                ));
            } else {
                response_parts.push("CRD installed".to_string());
            }

            if details.reconcile_stale {
                response_parts.push(format!(
                    "Reconcile loop stale (last event: {})",
                    details
                        .last_reconcile_event
                        .map(|t| t.to_rfc3339())
                        .unwrap_or_else(|| "Never".to_string())
                ));
            } else if details.last_reconcile_event.is_some() {
                response_parts.push(format!(
                    "Reconcile loop active (last event: {})",
                    details.last_reconcile_event.unwrap().to_rfc3339()
                ));
            }

            ControllerHealthStatus {
                healthy: is_healthy,
                response: response_parts.join("; "),
                details: Some(details),
            }
        }
        Err(e) => ControllerHealthStatus {
            healthy: false,
            response: format!("Controller health check failed: {}", e),
            details: None,
        },
    };

    let all_healthy = database_health.healthy
        && zitadel_health.healthy
        && controller_health.healthy
        && storage_locations_health
            .values()
            .all(|health: &HealthStatus| health.healthy);

    let status_code = if all_healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    let response_body = ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Health check successful".to_string(),
        data: Some(HealthResBody {
            all_healthy,
            database: database_health,
            zitadel: zitadel_health,
            controller: controller_health,
            storage_locations: storage_locations_health,
        }),
    };

    let json_string = if params.pretty {
        serde_json::to_string_pretty(&response_body)?
    } else {
        serde_json::to_string(&response_body)?
    };

    return Ok(Response::builder()
        .status(status_code)
        .header(header::CONTENT_TYPE, "application/json")
        .body(axum::body::Body::from(json_string))
        .unwrap());
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct HealthResBody {
    pub all_healthy: bool,
    pub database: DatabaseHealthStatus,
    pub zitadel: HealthStatus,
    pub controller: ControllerHealthStatus,
    pub storage_locations: HashMap<StorageLocationId, HealthStatus>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct HealthStatus {
    pub healthy: bool,
    pub message: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct DatabaseHealthStatus {
    pub healthy: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<DatabaseHealthDetails>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ControllerHealthStatus {
    pub healthy: bool,
    pub response: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<ControllerHealthDetails>,
}
