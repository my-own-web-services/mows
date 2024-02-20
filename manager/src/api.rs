use anyhow::bail;
use std::sync::Arc;
use tokio::sync::Mutex;

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    cluster::ClusterCreationConfig,
    config::{Cluster, Config, InstallState, Machine, PixiecoreBootConfig},
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
    Json(config.lock().await.clone())
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
        let machine = Machine::new(&machine_creation_config).await?;
        let mut config_locked = config.lock().await;
        config_locked.machines.insert(machine.id.clone(), machine);
    }

    Ok(Json(Success {
        message: "Machines created".to_string(),
    }))
}

#[utoipa::path(
    delete,
    path = "/api/machines/deleteall",
    responses(
        (status = 200, description = "Deleted machines", body = [Success]),
        (status = 500, description = "Failed to create machines", body = [String])
    )
)]
pub async fn delete_all_machines() -> Result<Json<Success>, AppError> {
    Machine::delete_all_mows_machines().await?;

    Ok(Json(Success {
        message: "Machines deleted".to_string(),
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
    Cluster::new(config).await?;

    Ok(Json(Success {
        message: "Cluster created".to_string(),
    }))
}

#[utoipa::path(
    get,
    path = "/v1/boot/{mac_addr}",
    params(
        ("mac_addr" = String, Path, description = "Mac address of the machine to get boot config for")
    ),
    responses(
        (status = 200, description = "Sending boot config to pixieboot server", body = [Success]),
        (status = 500, description = "Failed to get config for mac address", body = [PixiecoreBootConfig])
    )
)]
pub async fn get_boot_config_by_mac(
    State(config): State<Arc<Mutex<Config>>>,
    Path(mac_addr): Path<String>,
) -> Result<Json<PixiecoreBootConfig>, AppError> {
    Ok(Json(get_boot_config(mac_addr, config).await?))
}

pub async fn get_boot_config(
    mac_addr: String,
    config: Arc<Mutex<Config>>,
) -> Result<PixiecoreBootConfig, anyhow::Error> {
    let mut config = config.lock().await;

    for machine in config.machines.values_mut() {
        if let Some(mac) = &machine.mac {
            if mac == &mac_addr {
                if let Some(install) = &mut machine.install {
                    install.state = Some(InstallState::Requested);
                    if let Some(boot_config) = &install.boot_config {
                        return Ok(boot_config.clone());
                    }
                }
            }
        }
    }

    bail!("No machine found with mac address: {}", mac_addr)
}
