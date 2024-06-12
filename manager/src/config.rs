use std::{collections::HashMap, net::IpAddr};

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::some_or_bail;

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct Config {
    pub clusters: HashMap<String, Cluster>,
    pub external_providers: ExternalProviders,
    pub machines: HashMap<String, Machine>,
}

impl Config {
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

    pub fn apply_environment(&self) -> anyhow::Result<()> {
        // create the /tmp directory
        std::fs::create_dir_all("/tmp")?;

        self.write_kubeconfig()?;

        Ok(())
    }

    pub fn write_kubeconfig(&self) -> anyhow::Result<()> {
        for cluster in self.clusters.values() {
            let cluster_id = &cluster.id;

            let path = format!("/tmp/{}-kubeconfig.yml", cluster_id);
            let cluster = some_or_bail!(self.clusters.get(cluster_id), "Cluster not found");
            let kubeconfig = some_or_bail!(cluster.kubeconfig.as_ref(), "Kubeconfig not found");
            std::fs::write(&path, kubeconfig)?;

            // set the KUBECONFIG env var
            std::env::set_var("KUBECONFIG", &path);
            // TODO this only works for one cluster at a time
        }

        Ok(())
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
    pub id: String,
    pub machine_type: MachineType,
    pub mac: Option<String>,
    pub last_ip: Option<IpAddr>,
    pub install: Option<MachineInstall>,
}
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct MachineInstall {
    pub state: Option<InstallState>,
    pub primary: bool,
    pub boot_config: Option<PixiecoreBootConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Eq, PartialEq, Hash)]
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
