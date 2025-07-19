use crate::machines::MachineType;
use crate::providers::hcloud::ExternalProviderConfigHcloud;
use crate::public_ip::WgKeys;
use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::{Ipv4Addr, Ipv6Addr};
use std::path::Path;
use std::str::FromStr;
use std::sync::OnceLock;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::trace;
use utoipa::openapi::{Object, ObjectBuilder};
use utoipa::ToSchema;

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
        let ssh_config_path = Path::new("/root/.ssh/");
        let known_hosts_path = Path::new("/root/.ssh/");

        let mut known_hosts_file = String::new();
        let mut ssh_config_file = String::new();

        for machine in self.machines.values() {
            let remote_pub_key = match &machine.ssh.remote_public_key {
                Some(key) => key.clone(),
                None => match machine.ssh.get_remote_pub_key().await {
                    Ok(key) => key,
                    Err(e) => {
                        tracing::trace!("Failed to get remote public key: {:?}", e);
                        continue;
                    }
                },
            };

            machine
                .ssh
                .add_ssh_key_to_local_agent()
                .await
                .context(format!(
                    "Failed to add ssh key to local agent for node {}",
                    machine.id
                ))?;

            let hostname = machine
                .ssh
                .remote_hostname
                .clone()
                .unwrap_or(machine.id.clone());

            let val = format!(
                r#"
Host {}
    User {}
    IdentityFile /id/{}
    "#,
                hostname, machine.ssh.ssh_username, machine.id
            );

            ssh_config_file.push_str(&val);

            let val = format!("{} ssh-ed25519 {}\n", hostname, remote_pub_key);

            known_hosts_file.push_str(&val);
        }

        fs::create_dir_all(ssh_config_path)
            .await
            .context("Failed to create ssh config directory")?;

        fs::write(ssh_config_path.join("config"), ssh_config_file)
            .await
            .context("Failed to write ssh config")?;

        fs::create_dir_all(known_hosts_path)
            .await
            .context("Failed to create known_hosts directory")?;

        fs::write(known_hosts_path.join("known_hosts"), known_hosts_file)
            .await
            .context("Failed to write known_hosts")?;

        Ok(())
    }
}

#[derive(PartialEq, Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct ManagerConfig {
    pub clusters: HashMap<String, Cluster>,
    pub external_provider_config: Option<ExternalProviderConfigMap>,
    pub machines: HashMap<String, Machine>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct ExternalProviderConfigMap {
    pub hcloud: Option<ExternalProviderConfigHcloud>,
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
    pub public_ip_config: HashMap<String, PublicIpConfig>,
    pub cluster_backup_wg_private_key: Option<String>,
    pub install_state: Option<ClusterInstallState>,
    pub vault_secrets: Option<VaultSecrets>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct VaultSecrets {
    pub root_token: String,
    pub unseal_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct PublicIpVmProxy {
    pub machine_id: String,
    #[schema(schema_with = ipv6adr_to_schema)]
    pub ip: Option<Ipv6Addr>,
    #[schema(schema_with = ipv4adr_to_schema)]
    pub legacy_ip: Option<Ipv4Addr>,
    pub wg_keys: WgKeys,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub enum PublicIpConfig {
    MachineProxy(PublicIpVmProxy),
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct Vip {
    pub service: VipIp,
    pub controlplane: VipIp,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct VipIp {
    #[schema(schema_with = ipv6adr_to_schema)]
    pub ip: Option<Ipv6Addr>,
    #[schema(schema_with = ipv4adr_to_schema)]
    pub legacy_ip: Option<Ipv4Addr>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, PartialEq)]
pub struct Machine {
    // unique hostname
    pub id: String,
    pub machine_type: MachineType,
    pub install: Option<MachineInstall>,
    pub mac: Option<String>,
    pub ssh: SshAccess,
    #[schema(schema_with = ipv6adr_to_schema)]
    pub public_ip: Option<Ipv6Addr>,
    #[schema(schema_with = ipv4adr_to_schema)]
    pub public_legacy_ip: Option<Ipv4Addr>,
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

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ClusterNode {
    pub machine_id: String,
    pub internal_ips: InternalIps,
    pub primary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct InternalIps {
    #[schema(schema_with = ipv4adr_to_schema)]
    pub legacy: Ipv4Addr,
    #[schema(schema_with = ipv6adr_to_schema)]
    pub ip: Ipv6Addr,
}

impl InternalIps {
    pub fn from_index(index: u8) -> Self {
        let legacy = Ipv4Addr::new(10, 41, 0, 1 + index);
        let ip = Ipv6Addr::from_str(&format!("2001:cafe:41::{}", 1 + index))
            .expect("Invalid IPv6 address");
        InternalIps { legacy, ip }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct BackupNode {
    pub machine_id: String,
    pub hostname: String,
    pub mac: String,
    pub ssh: SshAccess,
    pub backup_wg_private_key: Option<String>,
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
    pub remote_hostname: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default, Eq, PartialEq)]
pub enum HelmDeploymentState {
    #[default]
    Requested,
    Installed,
    NotInstalled,
}

fn ipv4adr_to_schema() -> Object {
    ObjectBuilder::new()
        .schema_type(utoipa::openapi::schema::Type::String)
        .format(Some(utoipa::openapi::SchemaFormat::Custom(
            "Ipv4Addr".to_string(),
        )))
        .build()
}

fn ipv6adr_to_schema() -> Object {
    ObjectBuilder::new()
        .schema_type(utoipa::openapi::schema::Type::String)
        .format(Some(utoipa::openapi::SchemaFormat::Custom(
            "Ipv6Addr".to_string(),
        )))
        .build()
}
