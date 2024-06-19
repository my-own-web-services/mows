use anyhow::{bail, Context};
use std::{collections::HashMap, net::IpAddr};
use tokio::process::Command;

use crate::{
    api::machines::{MachineCreationReqBody, MachineSignal},
    config::{
        BackupNode, Cluster, ClusterNode, Machine, MachineInstall, MachineInstallState,
        MachineType, PixiecoreBootConfig, SshAccess,
    },
    some_or_bail,
    utils::{generate_id, get_current_ip_from_mac},
    write_config,
};

impl Machine {
    pub async fn new(machine_creation_config: &MachineCreationReqBody) -> anyhow::Result<Self> {
        Ok(match machine_creation_config {
            MachineCreationReqBody::LocalQemu(cc) => {
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
                        "linux2022",
                        "--machine",
                        "q35",
                        "--network",
                        "network=mows-manager,model=virtio",
                        "--video",
                        "qxl",
                        "--graphics",
                        "vnc,listen=0.0.0.0,websocket=-1",
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
                    last_ip: None,
                    machine_type: MachineType::LocalQemu,
                    install: None,
                };

                machine.force_off().await?;
                machine
            }
            MachineCreationReqBody::Local(_) => todo!(),
            MachineCreationReqBody::ExternalHetzner(_) => todo!(),
        })
    }

    pub async fn get_infos(&self) -> anyhow::Result<serde_json::Value> {
        Ok(match self.machine_type {
            MachineType::LocalQemu => {
                let output = Command::new("virsh")
                    .args(["dumpxml", &self.id])
                    .output()
                    .await?;
                let output = String::from_utf8(output.stdout)?;

                let xml: serde_json::Value = serde_xml_rs::from_str(&output)?;

                xml
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        })
    }

    pub async fn get_status(&self) -> anyhow::Result<String> {
        Ok(match self.machine_type {
            MachineType::LocalQemu => {
                let output = Command::new("virsh")
                    .args(["domstate", &self.id])
                    .output()
                    .await?;
                let output = String::from_utf8(output.stdout)?;

                output
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        })
    }

    pub async fn create_direct_attach_network() -> anyhow::Result<()> {
        todo!()
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
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
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

    pub async fn reboot(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["reboot", &self.id])
                    .spawn()?
                    .wait()
                    .await?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub async fn shutdown(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["shutdown", &self.id])
                    .spawn()?
                    .wait()
                    .await?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub async fn reset(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["reset", &self.id])
                    .spawn()?
                    .wait()
                    .await?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub async fn force_off(&self) -> anyhow::Result<()> {
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

    pub async fn send_signal(&self, machine_signal: MachineSignal) -> anyhow::Result<()> {
        match machine_signal {
            MachineSignal::Reboot => self.reboot().await,
            MachineSignal::Shutdown => self.shutdown().await,
            MachineSignal::Reset => self.reset().await,
            MachineSignal::ForceOff => self.force_off().await,
            MachineSignal::Start => self.start().await,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn configure_install(
        &self,
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
        k3s_token: &str,
        hostname: &str,
        ssh_config: &SshAccess,
        primary_node: &Option<String>,
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

        let mut config_lock = write_config!();

        let current_machine = some_or_bail!(
            config_lock.machines.get_mut(&self.id),
            "Machine not found: current_machine"
        );

        current_machine.install = Some(MachineInstall {
            state: Some(MachineInstallState::Requested),
            boot_config: Some(boot_config),
            primary: primary_node.is_none(),
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
        if let Some(install) = &self.install {
            if install.state == Some(MachineInstallState::Requested) {
                let node = &self
                    .get_attached_cluster_node(clusters)
                    .context("Could not find attached cluster node for requested install")?;

                let output = node
                    .ssh
                    .exec(self, &format!("sudo systemctl status k3s"), 1)
                    .await
                    .context("Could not get node status.")?;

                if output.contains("active (running)") {
                    Ok(())
                } else {
                    bail!("Node not ready")
                }
            } else {
                Ok(())
            }
        } else {
            bail!("No install found")
        }
    }

    pub async fn get_current_ip(&self) -> anyhow::Result<IpAddr> {
        let mut ip: Option<IpAddr> = None;

        if let Some(mac) = &self.mac {
            if let Ok(ip_from_mac) = get_current_ip_from_mac(mac).await {
                if let Ok(ip_from_mac_parsed) = ip_from_mac.parse() {
                    let mut config_lock = write_config!();
                    let current_machine =
                        some_or_bail!(config_lock.machines.get_mut(&self.id), "Machine not found");
                    current_machine.last_ip = Some(ip_from_mac_parsed);
                    drop(config_lock);
                    ip = Some(ip_from_mac_parsed);
                }
            }
        };

        if let Some(last_ip) = self.last_ip {
            ip = Some(last_ip);
        };

        if let Some(ip) = ip {
            Ok(ip)
        } else {
            bail!("No IP found")
        }
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
