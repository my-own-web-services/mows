use std::sync::Arc;
use tokio::sync::Mutex;

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    cluster::ClusterCreationConfig,
    config::{Cluster, Config, Machine},
    machines::MachineCreationConfig,
    utils::AppError,
};

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct Success {
    message: String,
}

#[utoipa::path(
    put,
    path = "/api/config",
    request_body = Config,
    responses(
        (status = 200, description = "Updates the config", body = [Success])
    )
)]
pub async fn update_config(
    State(config): State<Arc<Mutex<Config>>>,
    Json(posted_config): Json<Config>,
) -> Json<Success> {
    let mut config = config.lock().await;

    *config = posted_config;

    Json(Success {
        message: "Config updated".to_string(),
    })
}

#[utoipa::path(
    get,
    path = "/api/config",
    responses(
        (status = 200, description = "Gets the config", body = [Config])
    )
)]
pub async fn get_config(State(config): State<Arc<Mutex<Config>>>) -> Json<Config> {
    let config = config.lock().await.clone();

    Json(config)
}

#[utoipa::path(
    post,
    path = "/api/machines/create",
    request_body = MachineCreationConfig,
    responses(
        (status = 200, description = "Created machines", body = [Success]),
        (status = 500, description = "Failed to create machines", body = [String])
    )
)]
pub async fn create_machines(
    State(config): State<Arc<Mutex<Config>>>,
    Json(machine_creation_config): Json<MachineCreationConfig>,
) -> Result<Json<Success>, AppError> {
    for _ in 0..3 {
        let machine = Machine::new(&machine_creation_config)?;
        let mut config = config.lock().await;
        config
            .unassigned_machines
            .insert(machine.name.clone(), machine);
    }

    Ok(Json(Success {
        message: "Machines created".to_string(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/cluster/create",
    request_body = ClusterCreationConfig,
    responses(
        (status = 200, description = "Created cluster", body = [Success]),
        (status = 500, description = "Failed to create cluster", body = [String])
    )
)]
pub async fn create_cluster(
    State(config): State<Arc<Mutex<Config>>>,
    Json(cluster_creation_config): Json<ClusterCreationConfig>,
) -> Result<Json<Success>, AppError> {
    let mut config = config.lock().await;

    let cluster = Cluster::new(&config.unassigned_machines).await?;

    config.clusters.insert("default".to_string(), cluster);

    Ok(Json(Success {
        message: "Cluster created".to_string(),
    }))
}
