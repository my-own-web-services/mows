use std::collections::HashMap;

use anyhow::bail;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use utoipa::ToSchema;

use crate::{
    config::{
        BackupNode, Cluster, ClusterNode, InstallState, Machine, MachineInstall, MachineType,
        PixiecoreBootConfig, SshAccess,
    },
    some_or_bail,
    utils::generate_id,
};

impl Machine {
    pub async fn new(machine_creation_config: &MachineCreationConfig) -> anyhow::Result<Self> {
        Ok(match machine_creation_config {
            MachineCreationConfig::LocalQemu(cc) => {
                let machine_name: String = format!("mows-{}", generate_id(8));

                let primary_volume_name = format!("{}-ssd", machine_name);
                let primary_volume_size = 20;
                let secondary_volume_name = format!("{}-hdd", machine_name);
                let secondary_volume_size = 30;

                let memory = u32::from(cc.memory) * 1024;

                Command::new("virt-install")
                    .args([
                        "--name",
                        &machine_name,
                        "--memory",
                        memory.to_string().as_str(),
                        "--vcpus",
                        &cc.cpus.to_string(),
                        "--os-variant",
                        "generic",
                        "--machine",
                        "q35",
                        "--network",
                        "default,model=virtio",
                        "--boot",
                        "hd,network,menu=on",
                        "--pxe",
                        "--noautoconsole",
                        "--tpm",
                        "backend.type=emulator,backend.version=2.0,model=tpm-tis",
                        "--rng",
                        "/dev/urandom",
                        "--disk",
                        &format!(
                            "path=/var/lib/libvirt/images/{}.qcow2,size={},format=qcow2,bus=virtio",
                            primary_volume_name, primary_volume_size
                        ),
                        "--disk",
                        &format!(
                            "path=/var/lib/libvirt/images/{}.qcow2,size={},format=qcow2,bus=virtio",
                            secondary_volume_name, secondary_volume_size
                        ),
                    ])
                    .spawn()?
                    .wait()
                    .await?;

                let mac = qemu_get_mac_address(&machine_name).await?;

                let machine = Machine {
                    id: machine_name.clone(),
                    mac: Some(mac),
                    machine_type: MachineType::LocalQemu,
                    install: None,
                };

                machine.destroy().await?;
                machine
            }
            MachineCreationConfig::Local(_) => todo!(),
            MachineCreationConfig::ExternalHetzner(_) => todo!(),
        })
    }

    pub async fn delete(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["destroy", &self.id])
                    .spawn()?
                    .wait()
                    .await?;
                Command::new("virsh")
                    .args(["undefine", &self.id])
                    .spawn()?
                    .wait()
                    .await?;

                Command::new("virsh")
                    .args([
                        "vol-delete",
                        "--pool",
                        "default",
                        &format!("{}-primary.qcow2", &self.id),
                    ])
                    .spawn()?
                    .wait()
                    .await?;

                Command::new("virsh")
                    .args([
                        "vol-delete",
                        "--pool",
                        "default",
                        &format!("{}-secondary.qcow2", &self.id),
                    ])
                    .spawn()?
                    .wait()
                    .await?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub async fn destroy(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["destroy", &self.id])
                    .spawn()?
                    .wait()
                    .await?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub async fn start(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["start", &self.id])
                    .spawn()?
                    .wait()
                    .await?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub async fn delete_all_mows_machines() -> anyhow::Result<()> {
        let output = Command::new("virsh")
            .args(["list", "--all"])
            .output()
            .await?;
        let output = String::from_utf8(output.stdout)?;

        let lines: Vec<&str> = output.lines().collect();
        for line in lines {
            if line.contains("mows-") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                let name = some_or_bail!(parts.get(1), "No name found: name");
                let machine = Machine {
                    id: name.to_string(),
                    mac: None,
                    machine_type: MachineType::LocalQemu,
                    install: None,
                };
                machine.delete().await?;
            }
        }

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn configure_install(
        &mut self,
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
        k3s_token: &str,
        hostname: &str,
        ssh_config: &SshAccess,
        primary_node: bool,
    ) -> anyhow::Result<()> {
        let boot_config = PixiecoreBootConfig::new(
            kairos_version,
            k3s_version,
            os,
            k3s_token,
            hostname,
            ssh_config,
            primary_node,
        )
        .await?;

        self.install = Some(MachineInstall {
            state: Some(InstallState::Configured),
            boot_config: Some(boot_config),
        });

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

    pub async fn poll_install_state(
        &self,
        clusters: &HashMap<String, Cluster>,
    ) -> anyhow::Result<()> {
        if self.install.is_some() {
            let node_ssh_access = &self.get_attached_cluster_node(clusters)?.ssh_access;
            node_ssh_access.exec(self, "kubectl get nodes", 5).await?;
            return Ok(());
        };
        bail!("No install found")
    }
}

async fn qemu_get_mac_address(node_name: &str) -> anyhow::Result<String> {
    let output = Command::new("virsh")
        .args(["domiflist", node_name])
        .output()
        .await?;
    let output = String::from_utf8(output.stdout)?;

    let lines: Vec<&str> = output.lines().collect();
    let mac_line = some_or_bail!(lines.get(2), "No MAC address found: mac_line");
    let parts: Vec<&str> = mac_line.split_whitespace().collect();
    let mac_address = some_or_bail!(parts.get(4), "No MAC address found: mac_address");

    Ok(mac_address.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum MachineCreationConfig {
    LocalQemu(LocalQemuConfig),
    Local(Vec<String>),
    ExternalHetzner(ExternalHetznerConfig),
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct LocalQemuConfig {
    /**
     * Memory in GB
     */
    pub memory: u8,
    pub cpus: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ExternalHetznerConfig {
    pub server_type: String,
}

pub struct Arp {
    pub ip: String,
    pub hwtype: String,
    pub mac: String,
}

pub async fn get_connected_machines() -> anyhow::Result<Vec<Arp>> {
    let output = Command::new("arp").output().await?;
    let output = String::from_utf8(output.stdout)?;

    let lines: Vec<&str> = output.lines().skip(1).collect();

    let mut arp_lines = vec![];

    for line in lines {
        let arp_line: Vec<&str> = line.split_whitespace().collect();

        arp_lines.push(Arp {
            ip: some_or_bail!(arp_line.first(), "Could not get ip from arp").to_string(),
            hwtype: some_or_bail!(arp_line.get(1), "Could not get hwtype from arp").to_string(),
            mac: some_or_bail!(arp_line.get(2), "Could not get mac from arp").to_string(),
        });
    }

    Ok(arp_lines)
}
