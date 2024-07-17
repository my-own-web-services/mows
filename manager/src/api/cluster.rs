use crate::{
    config::{Cluster, ClusterInstallState},
    dev_mode_disabled, get_current_config_cloned,
    machines::MachineType,
    types::{ApiResponse, ApiResponseStatus},
    write_config,
};
use axum::Json;
use serde::{Deserialize, Serialize};
use tracing::info;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/dev/cluster/create_from_all_machines_in_inventory",
    request_body = ClusterCreationConfig,
    responses(
        (status = 200, description = "Cluster creation started...", body = ApiResponse),
    )
)]
pub async fn dev_create_cluster_from_all_machines_in_inventory(
    Json(_cluster_creation_config): Json<ClusterCreationConfig>,
) -> Json<ApiResponse<()>> {
    dev_mode_disabled!();

    let cfg = get_current_config_cloned!();

    // get the ids of all machines that are LocalQemu
    let machine_ids: Vec<String> = cfg
        .machines
        .iter()
        .filter(|(_, machine)| machine.machine_type == MachineType::LocalQemu)
        .map(|(id, _)| id.clone())
        .collect();

    match Cluster::new(&machine_ids).await {
        Ok(_) => Json(ApiResponse {
            message: "Cluster creation started...".to_string(),
            status: ApiResponseStatus::Success,
            data: None,
        }),
        Err(e) => Json(ApiResponse {
            message: format!("Failed to create cluster: {}", e),
            status: ApiResponseStatus::Error,
            data: None,
        }),
    }
}

#[utoipa::path(
    post,
    path = "/api/dev/cluster/install_basics",
    responses(
        (status = 200, description = "Installed basics", body = ApiResponse),
    )
)]
pub async fn dev_install_cluster_basics() -> Json<ApiResponse<()>> {
    dev_mode_disabled!();
    let config = get_current_config_cloned!();
    for cluster in config.clusters.values() {
        if cluster.kubeconfig.is_some() {
            info!("Installing basics for cluster {}", cluster.id);
            if let Err(e) = cluster.install_basics().await {
                return Json(ApiResponse {
                    message: format!("Failed to install basics for cluster {}: {}", cluster.id, e),
                    status: ApiResponseStatus::Error,
                    data: None,
                });
            };
            info!("Installed basics for cluster {}", cluster.id);

            let mut config_locked2 = write_config!();
            let cluster = match config_locked2.clusters.get_mut(&cluster.id) {
                Some(cluster) => cluster,
                None => {
                    return Json(ApiResponse {
                        message: "Cluster not found".to_string(),
                        status: ApiResponseStatus::Error,
                        data: None,
                    });
                }
            };
            cluster.install_state = Some(ClusterInstallState::BasicsConfigured);
        }
    }

    Json(ApiResponse {
        message: "Basics installed".to_string(),
        status: ApiResponseStatus::Success,
        data: None,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterCreationConfig {}
