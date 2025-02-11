pub mod clusters {

    use std::{collections::HashMap, net::Ipv4Addr};

    use crate::{
        cluster::cluster::ClusterStatus,
        config::{config, Cluster, ClusterInstallState, ClusterNode, InternalIps},
        dev_mode_disabled, get_current_config_cloned,
        internal_config::INTERNAL_CONFIG,
        machines::MachineType,
        types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
        write_config,
    };
    use axum::{
        extract::{
            ws::{Message, WebSocket},
            WebSocketUpgrade,
        },
        response::IntoResponse,
        Json,
    };
    use serde::{Deserialize, Serialize};
    use tracing::{debug, info};
    use utoipa::ToSchema;
    use utoipa_axum::{router::OpenApiRouter, routes};

    pub fn router() -> OpenApiRouter {
        OpenApiRouter::new()
            .routes(routes!(dev_create_cluster_from_all_machines_in_inventory))
            .routes(routes!(dev_install_cluster_basics))
            .routes(routes!(get_cluster_status))
            .routes(routes!(signal_cluster))
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
    pub struct ClusterStatusResBody {
        pub id: String,
        pub status: ClusterStatus,
    }

    // machine status with socket
    #[utoipa::path(get, path = "/status",responses(
    (status = 200, description = "Got the Cluster status", body =  ApiResponse<ClusterStatusResBody>),
))]
    async fn get_cluster_status(ws: WebSocketUpgrade) -> impl IntoResponse {
        ws.on_upgrade(move |socket| handle_get_cluster_status(socket))
    }

    async fn handle_get_cluster_status(mut socket: WebSocket) {
        'outer: loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

            let config = get_current_config_cloned!();

            for cluster in config.clusters.values() {
                let status = match cluster.get_status().await {
                    Ok(status) => status,
                    Err(e) => {
                        tracing::error!("Failed to get status: {:?}", e);
                        continue;
                    }
                };

                let status = ClusterStatusResBody {
                    id: cluster.id.clone(),
                    status,
                };

                let message = Message::Text(serde_json::to_string(&status).unwrap().into());
                match socket.send(message).await {
                    Ok(_) => continue,
                    Err(_e) => {
                        //error!("Failed to send message: {:?}", e);
                        break 'outer;
                    }
                }
            }
        }
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
    pub struct ClusterSignalReqBody {
        pub signal: ClusterSignal,
        pub cluster_id: String,
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
    pub enum ClusterSignal {
        Start,
        Restart,
        Stop,
    }

    #[utoipa::path(
        post,
        path = "/signal",
        request_body = ClusterSignalReqBody,
        responses(
            (status = 200, description = "Sent signal", body = ApiResponse<EmptyApiResponse>),
        )
    )]
    async fn signal_cluster(
        Json(cluster_signal): Json<ClusterSignalReqBody>,
    ) -> Json<ApiResponse<()>> {
        let config = get_current_config_cloned!();

        let cluster = match config
            .clusters
            .get(&cluster_signal.cluster_id)
            .ok_or(anyhow::Error::msg("Cluster not found"))
        {
            Ok(cluster) => cluster.clone(),
            Err(e) => {
                return Json(ApiResponse {
                    message: format!("Failed to send signal: {}", e),
                    status: ApiResponseStatus::Error,
                    data: None,
                })
            }
        };

        tokio::spawn(async move {
            match cluster.send_signal(cluster_signal.signal).await {
                Ok(_) => {
                    info!("Sent signal to cluster {}", cluster.id);
                }
                Err(e) => {
                    tracing::error!("Failed to send signal to cluster {}: {}", cluster.id, e);
                }
            }
        });

        Json(ApiResponse {
            message: "Sent signal".to_string(),
            status: ApiResponseStatus::Success,
            data: None,
        })
    }

    #[utoipa::path(
    post,
    path = "/dev_create_from_all_machines_in_inventory",
    request_body = ClusterCreationConfig,
    responses(
        (status = 200,  body = ApiResponse<EmptyApiResponse>),
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
                legacy: Ipv4Addr::new(10, 41, 0, 1 + u8::try_from(i)?),
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
    path = "/dev_install_basics",
    responses(
        (status = 200, description = "Installed basics", body = ApiResponse<EmptyApiResponse>),
    )
)]
    pub async fn dev_install_cluster_basics() -> Json<ApiResponse<()>> {
        dev_mode_disabled!();
        let config = get_current_config_cloned!();
        for cluster in config.clusters.values() {
            if cluster.kubeconfig.is_some() {
                info!("Installing basics for cluster {}", cluster.id);
                if let Err(e) = cluster.install_core_cloud_system().await {
                    return Json(ApiResponse {
                        message: format!(
                            "Failed to install basics for cluster {}: {}",
                            cluster.id, e
                        ),
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
}
