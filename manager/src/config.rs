use std::{collections::HashMap, net::IpAddr};

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct Config {
    pub clusters: HashMap<String, Cluster>,
    pub external_providers: ExternalProviders,
    pub machines: HashMap<String, Machine>,
}

impl Config {
    pub fn get_node_by_name(&self, node_name: &str) -> Option<ClusterNode> {
        for cluster in self.clusters.values() {
            if let Some(node) = cluster.cluster_nodes.get(node_name) {
                return Some(node.clone());
            }
        }
        None
    }

    pub fn get_machine_by_name(&self, machine_name: &str) -> Option<Machine> {
        for machine in self.machines.values() {
            if machine.id == machine_name {
                return Some(machine.clone());
            }
        }
        None
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct Cluster {
    pub id: String,
    pub cluster_nodes: HashMap<String, ClusterNode>,
    pub kubeconfig: Option<String>,
    pub k3s_token: String,
    pub encryption_key: Option<String>,
    pub backup_nodes: HashMap<String, BackupNode>,
    pub public_ip_config: Option<PublicIpConfig>,
    pub cluster_backup_wg_private_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct Machine {
    pub machine_type: MachineType,
    pub mac: Option<String>,
    pub id: String,
    pub install: Option<MachineInstall>,
}
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct MachineInstall {
    pub state: Option<InstallState>,
    pub boot_config: Option<PixiecoreBootConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum InstallState {
    Configured,
    Requested,
    Installed,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct PixiecoreBootConfig {
    pub kernel: String,
    pub initrd: Vec<String>,
    pub cmdline: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub enum MachineType {
    #[default]
    LocalQemu,
    Local,
    ExternalHetzner,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterNode {
    pub machine_id: String,
    pub hostname: String,
    pub ssh_access: SshAccess,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct BackupNode {
    pub machine_id: String,
    pub hostname: String,
    pub mac: String,
    pub ssh_access: SshAccess,
    pub backup_wg_private_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct ExternalProviders {
    pub hetzner: Option<ExternalProvidersHetzner>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ExternalProvidersHetzner {
    pub api_token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PublicIpConfig {
    pub ips: HashMap<String, PublicIpConfigSingleIp>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PublicIpConfigSingleIp {
    pub provider: ExternalProviderIpOptions,
    pub ip: IpAddr,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum ExternalProviderIpOptions {
    Hetzner(ExternalProviderIpOptionsHetzner),
    Own,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ExternalProviderIpOptionsHetzner {
    pub server_id: String,
    pub ssh_access: Option<SshAccess>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct SshAccess {
    pub ssh_username: String,
    pub ssh_private_key: String,
    pub ssh_public_key: String,
    pub ssh_passphrase: String,
    pub ssh_password: String,
    pub remote_fingerprint: Option<String>,
}
