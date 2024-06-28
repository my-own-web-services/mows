use std::net::SocketAddr;

use crate::{
    config::{Cluster, ClusterInstallState},
    get_current_config_cloned,
    types::Success,
    utils::AppError,
    write_config,
};
use axum::{extract::ConnectInfo, Json};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/dev/cluster/create_from_all_machines_in_inventory",
    request_body = ClusterCreationConfig,
    responses(
        (status = 200, description = "Created cluster", body = Success),
        (status = 500, description = "Failed to create cluster", body = String)
    )
)]
pub async fn dev_create_cluster_from_all_machines_in_inventory(
    Json(_cluster_creation_config): Json<ClusterCreationConfig>,
) -> Result<Json<Success>, AppError> {
    Cluster::new().await?;

    Ok(Json(Success {
        message: "Cluster created".to_string(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/dev/cluster/install_basics",
    responses(
        (status = 200, description = "Installed basics", body = Success),
        (status = 500, description = "Failed to install basics", body = String)
    )
)]
pub async fn dev_install_cluster_basics() -> Result<Json<Success>, AppError> {
    let config = get_current_config_cloned!();
    for cluster in config.clusters.values() {
        if cluster.kubeconfig.is_some() {
            info!("Installing basics for cluster {}", cluster.id);
            cluster.install_basics().await?;
            info!("Installed basics for cluster {}", cluster.id);

            let mut config_locked2 = write_config!();
            let cluster = match config_locked2.clusters.get_mut(&cluster.id) {
                Some(cluster) => cluster,
                None => return Err(anyhow::Error::msg("Cluster not found").into()),
            };
            cluster.install_state = Some(ClusterInstallState::BasicsConfigured);
        }
    }

    Ok(Json(Success {
        message: "Cluster basics installed".to_string(),
    }))
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterCreationConfig {}
