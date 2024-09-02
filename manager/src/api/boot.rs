use std::net::Ipv4Addr;

use anyhow::bail;
use axum::{extract::Path, Json};
use tower_http::trace;
use tracing::{debug, info};
use utoipa::openapi::info;

use crate::{
    config::{
        Cluster, ClusterNode, InternalIps, Machine, MachineInstallState, PixiecoreBootConfig,
    },
    get_current_config_cloned,
    internal_config::INTERNAL_CONFIG,
    providers::local_physical::machine::LocalMachineProviderPhysicalConfig,
    some_or_bail,
    utils::AppError,
    write_config,
};

use super::{config, machines::MachineCreationReqType};

#[utoipa::path(
    get,
    path = "/v1/boot/{mac_addr}",
    params(
        ("mac_addr" = String, Path, description = "Mac address of the machine to get boot config for")
    ),
    responses(
        (status = 200, description = "Sending boot config to pixieboot server", body = PixiecoreBootConfig),
        (status = 500, description = "Failed to get config for mac address", body = String)
    )
)]
pub async fn get_boot_config_by_mac(
    Path(mac_addr): Path<String>,
) -> Result<Json<PixiecoreBootConfig>, AppError> {
    Ok(Json(get_boot_config(mac_addr).await?))
}

pub async fn get_boot_config(mac_addr: String) -> Result<PixiecoreBootConfig, anyhow::Error> {
    for _ in 0..2 {
        let mut config = write_config!();

        let ic = &INTERNAL_CONFIG;

        debug!("Getting boot config for mac address: {}", mac_addr);

        for machine in config.machines.values_mut() {
            if let Some(mac) = &machine.mac {
                if mac == &mac_addr {
                    if let Some(install) = &mut machine.install {
                        install.state = Some(MachineInstallState::Requested);
                        if let Some(boot_config) = &install.boot_config {
                            return Ok(boot_config.clone());
                        }
                    }
                }
            }
        }
        drop(config);

        if ic.dev.send_default_netboot_config_if_mac_unknown {
            info!("DEV: Sending default boot config because mac is unknown");
            return Ok(PixiecoreBootConfig::new_default().await?);
        }

        handle_local_boot_request(&mac_addr).await?;
    }

    bail!("No machine found with mac address: {}", mac_addr)
}

pub async fn handle_local_boot_request(mac_addr: &str) -> Result<(), anyhow::Error> {
    let ic = &INTERNAL_CONFIG;

    let machine = Machine::new(&MachineCreationReqType::LocalPhysical(
        LocalMachineProviderPhysicalConfig {
            mac_address: mac_addr.to_string(),
        },
    ))
    .await?;

    {
        let mut config = write_config!();

        // check if a cluster exists, if not create one
        if config.clusters.values().count() == 0 {
            let cluster = Cluster::new().await?;
            config.clusters.insert(cluster.id.clone(), cluster);
        };

        // get the cluster, assuming there is only one
        let cluster = config.clusters.values_mut().next().unwrap();

        let cluster_node_count = cluster.cluster_nodes.len();

        let internal_ips = InternalIps {
            legacy: Ipv4Addr::new(10, 41, 0, 1 + cluster_node_count as u8),
        };

        cluster.cluster_nodes.insert(
            machine.id.clone(),
            ClusterNode {
                machine_id: machine.id.to_string(),
                internal_ips: internal_ips.clone(),
                primary: cluster_node_count == 0,
            },
        );

        config.machines.insert(machine.id.clone(), machine.clone());

        drop(config);
    }

    {
        let config = get_current_config_cloned!();
        let cluster = config.clusters.values().next().unwrap();

        let primary_hostname = cluster
            .cluster_nodes
            .iter()
            .find(|(_, node)| node.primary)
            .map(|(hostname, _)| hostname);

        let cluster_node = some_or_bail!(
            cluster
                .cluster_nodes
                .iter()
                .find(|(_, node)| node.machine_id == machine.id)
                .map(|(_, node)| node),
            "No cluster node found"
        );

        machine
            .configure_install(
                &ic.os_config.kairos_version,
                &ic.os_config.k3s_version,
                &ic.os_config.os,
                &cluster.k3s_token,
                &machine.id,
                &primary_hostname.clone().unwrap(),
                &cluster.vip,
                &cluster_node.internal_ips,
            )
            .await?;
    }

    Ok(())
}
