use std::{collections::HashMap, net::Ipv4Addr};

use crate::{
    config::{Cluster, ClusterInstallState, ClusterNode, InternalIps, Machine},
    dev_mode_disabled, get_current_config_cloned,
    internal_config::INTERNAL_CONFIG,
    machines::MachineType,
    types::{ApiResponse, ApiResponseStatus},
    write_config,
};
use axum::Json;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};
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

    match handle_dev_create_cluster_from_all_machines_in_inventory().await {
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

pub async fn handle_dev_create_cluster_from_all_machines_in_inventory() -> anyhow::Result<()> {
    let mut cluster = Cluster::new().await?;
    let ic = &INTERNAL_CONFIG;

    let cfg = get_current_config_cloned!();

    // get the machines that are LocalQemu
    let machines = cfg
        .machines
        .iter()
        .filter(|(_, machine)| machine.machine_type == MachineType::LocalQemu)
        .collect::<HashMap<_, _>>();

    let mut primary_hostname: Option<String> = None;
    let mut cluster_nodes = HashMap::new();

    for (i, (machine_hostname, machine)) in machines.iter().enumerate() {
        if machine.install.is_some() {
            continue;
        }
        let hostname = machine_hostname.to_lowercase();

        if i == 0 {
            primary_hostname = Some(hostname.clone());
        }

        let internal_ips = InternalIps {
            legacy: Ipv4Addr::new(10, 41, 0, 1 + i as u8),
        };

        machine
            .configure_install(
                &ic.os_config.kairos_version,
                &ic.os_config.k3s_version,
                &ic.os_config.os,
                &cluster.k3s_token,
                &hostname,
                &primary_hostname.clone().unwrap(),
                &cluster.vip,
                &internal_ips,
            )
            .await?;

        cluster_nodes.insert(
            hostname.clone(),
            ClusterNode {
                machine_id: machine_hostname.to_string(),
                internal_ips,
                primary: i == 0,
            },
        );
    }

    cluster.cluster_nodes = cluster_nodes;

    let mut config = write_config!();

    config.clusters.insert(cluster.id.clone(), cluster.clone());

    drop(config);

    tokio::spawn(async move {
        let config = get_current_config_cloned!();
        cluster.start_all_machines(&config).await.unwrap();
        debug!("Cluster {} was created", cluster.id);
    });

    Ok(())
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
