use anyhow::{bail, Context};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tracing::debug;
use utoipa::ToSchema;

use crate::{
    api::machines::{MachineCreationReqType, MachineSignal},
    config::{
        BackupNode, Cluster, ClusterNode, InternalIps, Machine, MachineInstall,
        MachineInstallState, PixiecoreBootConfig, Vip,
    },
    providers::{
        hcloud::machine::ExternalProviderMachineHcloud,
        local_physical::machine::LocalMachineProviderPhysical,
        qemu::machine::LocalMachineProviderQemu,
    },
    public_ip::remove_public_ip_config_if_exists,
    some_or_bail,
    utils::generate_id,
    write_config,
};

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub enum MachineType {
    #[default]
    LocalQemu,
    LocalPhysical,
    ExternalHcloud,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub enum MachineStatus {
    Running,
    Stopped,
    Unknown,
    Suspended,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct VncWebsocket {
    pub url: String,
    pub password: String,
}

impl Machine {
    pub async fn new(machine_creation_config: &MachineCreationReqType) -> anyhow::Result<Self> {
        let machine_name: String = format!("mows-{}", generate_id(8)).to_lowercase();

        Ok(match machine_creation_config {
            MachineCreationReqType::LocalQemu(cc) => {
                LocalMachineProviderQemu::new(cc, &machine_name).await?
            }
            MachineCreationReqType::LocalPhysical(cc) => {
                LocalMachineProviderPhysical::new(cc, &machine_name).await?
            }
            MachineCreationReqType::ExternalHcloud(hc) => {
                ExternalProviderMachineHcloud::new(hc, &machine_name).await?
            }
        })
    }

    pub async fn exec(&self, command: &str, inactivity_timeout: u64) -> anyhow::Result<String> {
        self.ssh.exec(&self, command, inactivity_timeout).await
    }

    pub async fn get_infos(&self) -> anyhow::Result<serde_json::Value> {
        Ok(match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::get_infos(&self.id).await?,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => json!({}),
        })
    }

    pub async fn get_status(&self) -> anyhow::Result<MachineStatus> {
        Ok(match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::get_status(&self.id).await?,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => {
                ExternalProviderMachineHcloud::get_status(&self.id).await?
            }
        })
    }

    pub async fn create_direct_attach_network() -> anyhow::Result<()> {
        todo!()
    }

    pub async fn delete(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                LocalMachineProviderQemu::delete(&self.id).await?;
            }
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => {
                if let Err(e) = ExternalProviderMachineHcloud::delete(&self.id).await {
                    match e {
                        crate::providers::hcloud::machine::HcloudError::ServerToBeDeletedNotFoundAtHcloud => (), // if the server is already deleted at hcloud we ignore the error and continue to remove the machine from the inventory
                        crate::providers::hcloud::machine::HcloudError::GenericHcloudError(error) => bail!(error)
                    };
                };

                remove_public_ip_config_if_exists(&self.id).await?;
            }
        };
        let mut config_lock = write_config!();

        // remove the machine from the machine inventory
        config_lock.machines.remove(&self.id);
        let mut clusters_to_delete = vec![];
        for cluster in config_lock.clusters.values_mut() {
            // remove the machine from all clusters and backup nodes
            cluster.cluster_nodes.remove(&self.id);
            cluster.backup_nodes.remove(&self.id);
            // if we just deleted the last machine in the cluster we remove the cluster

            if cluster.cluster_nodes.is_empty() && cluster.backup_nodes.is_empty() {
                clusters_to_delete.push(cluster.id.clone());
            }
        }
        for cluster_id in clusters_to_delete {
            config_lock.clusters.remove(&cluster_id);
        }

        Ok(())
    }

    pub async fn start(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::start(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn suspend(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::suspend(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn resume(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::resume(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn reboot(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::reboot(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn shutdown(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::shutdown(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn reset(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::reset(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn force_off(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::force_off(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => bail!("Not implemented"),
        }
    }

    pub async fn get_vnc_websocket(&self) -> anyhow::Result<VncWebsocket> {
        match self.machine_type {
            MachineType::LocalQemu => LocalMachineProviderQemu::get_vnc_websocket(&self.id).await,
            MachineType::LocalPhysical => bail!("Not implemented"),
            MachineType::ExternalHcloud => {
                ExternalProviderMachineHcloud::get_vnc_websocket(&self.id).await
            }
        }
    }

    pub async fn send_signal(&self, machine_signal: MachineSignal) -> anyhow::Result<()> {
        match machine_signal {
            MachineSignal::Reboot => self.reboot().await,
            MachineSignal::Shutdown => self.shutdown().await,
            MachineSignal::Reset => self.reset().await,
            MachineSignal::ForceOff => self.force_off().await,
            MachineSignal::Start => self.start().await,
            MachineSignal::Suspend => self.suspend().await,
            MachineSignal::Resume => self.resume().await,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn configure_install(
        &self,
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
        k3s_token: &str,
        own_hostname: &str,
        primary_node_hostname: &str,
        vip: &Vip,
        internal_ips: &InternalIps,
    ) -> anyhow::Result<()> {
        let virt = if self.machine_type == MachineType::LocalQemu {
            true
        } else {
            false
        };

        let boot_config = PixiecoreBootConfig::new(
            kairos_version,
            k3s_version,
            os,
            k3s_token,
            own_hostname,
            &self.ssh,
            primary_node_hostname,
            virt,
            vip,
            internal_ips,
        )
        .await?;

        let mut config_lock = write_config!();

        let current_machine = some_or_bail!(
            config_lock.machines.get_mut(&self.id),
            "Machine not found: current_machine"
        );

        current_machine.install = Some(MachineInstall {
            state: Some(MachineInstallState::Requested),
            boot_config: Some(boot_config),
            primary: primary_node_hostname == own_hostname,
        });

        debug!("Machine install configured: {}", self.id);

        Ok(())
    }

    pub fn get_attached_cluster_node(
        &self,
        clusters: &HashMap<String, Cluster>,
    ) -> anyhow::Result<ClusterNode> {
        for (_, cluster) in clusters.iter() {
            for (_, node) in cluster.cluster_nodes.iter() {
                if node.machine_id == self.id {
                    return Ok(node.clone());
                }
            }
        }
        bail!("No node found")
    }

    pub fn get_attached_backup_node(
        &self,
        clusters: &HashMap<String, Cluster>,
    ) -> anyhow::Result<BackupNode> {
        for (_, cluster) in clusters.iter() {
            for (_, node) in cluster.backup_nodes.iter() {
                if node.machine_id == self.id {
                    return Ok(node.clone());
                }
            }
        }
        bail!("No node found")
    }

    pub async fn poll_install_state(&self) -> anyhow::Result<()> {
        let output = &self
            .exec(&format!("sudo systemctl status k3s"), 1)
            .await
            .context("Could not get node status.")?;

        if output.contains("active (running)") {
            Ok(())
        } else {
            bail!("Node not ready")
        }
    }
}
