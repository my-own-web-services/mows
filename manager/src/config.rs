use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, Ipv6Addr};
use std::sync::OnceLock;
use std::{collections::HashMap, net::IpAddr};
use tokio::fs;
use tokio::sync::RwLock;
use tracing::trace;
use utoipa::ToSchema;

use crate::some_or_bail;

#[tracing::instrument]
pub fn config() -> &'static RwLock<ManagerConfig> {
    static CONFIG: OnceLock<RwLock<ManagerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(ManagerConfig::default()))
}

impl ManagerConfig {
    pub fn get_node_by_machine_id(&self, machine_id: &str) -> Option<ClusterNode> {
        for cluster in self.clusters.values() {
            if let Some(node) = cluster.cluster_nodes.get(machine_id) {
                return Some(node.clone());
            }
        }
        None
    }

    pub fn get_machine_by_id(&self, machine_id: &str) -> Option<Machine> {
        for machine in self.machines.values() {
            if machine.id == machine_id {
                return Some(machine.clone());
            }
        }
        None
    }

    pub async fn set_cluster_hostname(&self) -> anyhow::Result<()> {
        for cluster in self.clusters.values() {
            if let Some(ip) = &cluster.vip.service.legacy_ip {
                fs::write(
                    format!("/hosts/service.{}", cluster.id),
                    format!("{} svc.{} \n {} svc.{} ", ip, cluster.id, ip, cluster.id),
                )
                .await?;

                fs::write(
                    format!("/hosts/cp.{}", cluster.id),
                    format!("{} cp.{}", ip, cluster.id),
                )
                .await?;
            }
        }

        Ok(())
    }

    pub async fn apply_environment(&self) -> anyhow::Result<()> {
        trace!("Applying environment");
        match self.write_local_kubeconfig().await {
            Ok(_) => trace!("Wrote local kubeconfig"),
            Err(e) => trace!("Failed to write local kubeconfig: {:?}", e),
        }
        match self.setup_local_ssh_access().await {
            Ok(_) => trace!("Setup local ssh access"),
            Err(e) => trace!("Failed to setup local ssh access: {:?}", e),
        }
        match self.set_cluster_hostname().await {
            Ok(_) => trace!("Set cluster hostname"),
            Err(e) => trace!("Failed to set cluster hostname: {:?}", e),
        }

        Ok(())
    }

    pub async fn write_local_kubeconfig(&self) -> anyhow::Result<()> {
        for (i, cluster) in self.clusters.values().enumerate() {
            cluster.write_local_kubeconfig().await?;
            if i > 0 {
                todo!("This only works for one cluster at a time")
            }
        }
        Ok(())
    }

    pub async fn setup_local_ssh_access(&self) -> anyhow::Result<()> {
        for (i, cluster) in self.clusters.values().enumerate() {
            cluster.setup_local_ssh_access().await?;
            if i > 0 {
                todo!("This only works for one cluster at a time")
            }
        }
        Ok(())
    }
}

#[derive(PartialEq, Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct ManagerConfig {
    pub clusters: HashMap<String, Cluster>,
    pub external_providers: ExternalProviders,
    pub machines: HashMap<String, Machine>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct Cluster {
    pub id: String,
    pub vip: Vip,
    pub cluster_nodes: HashMap<String, ClusterNode>,
    pub kubeconfig: Option<String>,
    pub k3s_token: String,
    pub encryption_key: Option<String>,
    pub backup_nodes: HashMap<String, BackupNode>,
    pub public_ip_config: Option<PublicIpConfig>,
    pub cluster_backup_wg_private_key: Option<String>,
    pub install_state: Option<ClusterInstallState>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct Vip {
    pub service: VipIp,
    pub controlplane: VipIp,
}
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]

pub struct VipIp {
    pub legacy_ip: Option<String>,
    pub ip: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct Machine {
    pub id: String,
    pub machine_type: MachineType,
    pub mac: Option<String>,
    pub install: Option<MachineInstall>,
}
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct MachineInstall {
    pub state: Option<MachineInstallState>,
    pub primary: bool,
    pub boot_config: Option<PixiecoreBootConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Eq, PartialEq, Hash)]
pub enum MachineInstallState {
    Configured,
    Requested,
    Installed,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Eq, PartialEq, Hash)]
pub enum ClusterInstallState {
    Kubernetes,
    BasicsConfigured,
    BasicsReady,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct PixiecoreBootConfig {
    pub kernel: String,
    pub initrd: Vec<String>,
    pub cmdline: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub enum MachineType {
    #[default]
    LocalQemu,
    Local,
    ExternalHetzner,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ClusterNode {
    pub machine_id: String,
    pub hostname: String,
    pub ssh: SshAccess,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct BackupNode {
    pub machine_id: String,
    pub hostname: String,
    pub mac: String,
    pub ssh: SshAccess,
    pub backup_wg_private_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct ExternalProviders {
    pub hetzner: Option<ExternalProvidersHetzner>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ExternalProvidersHetzner {
    pub api_token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct PublicIpConfig {
    pub ips: HashMap<String, PublicIpConfigSingleIp>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct PublicIpConfigSingleIp {
    pub provider: ExternalProviderIpOptions,
    pub ip: IpAddr,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub enum ExternalProviderIpOptions {
    Hetzner(ExternalProviderIpOptionsHetzner),
    Own,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ExternalProviderIpOptionsHetzner {
    pub server_id: String,
    pub ssh_access: Option<SshAccess>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, Eq, PartialEq)]
pub struct SshAccess {
    pub ssh_username: String,
    pub ssh_private_key: String,
    pub ssh_public_key: String,
    pub ssh_passphrase: String,
    pub ssh_password: String,
    pub remote_public_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, Eq, PartialEq)]
pub enum HelmDeploymentState {
    #[default]
    Requested,
    Installed,
    NotInstalled,
}
