use std::process::Command;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    config::{Machine, MachineType},
    some_or_bail,
    utils::generate_id,
};

impl Machine {
    pub fn new(machine_creation_config: &MachineCreationConfig) -> anyhow::Result<Self> {
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
                    .wait()?;

                let mac = qemu_get_mac_address(&machine_name)?;

                let machine = Machine {
                    name: machine_name.clone(),
                    mac: Some(mac),
                    machine_type: MachineType::LocalQemu,
                };

                machine.destroy()?;
                machine
            }
            MachineCreationConfig::Local(_) => todo!(),
            MachineCreationConfig::ExternalHetzner(_) => todo!(),
        })
    }

    pub fn delete(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["destroy", &self.name])
                    .spawn()?;
                Command::new("virsh")
                    .args(["undefine", &self.name])
                    .spawn()?
                    .wait()?;

                Command::new("virsh")
                    .args([
                        "vol-delete",
                        "--pool",
                        "default",
                        &format!("{}-primary.qcow2", &self.name),
                    ])
                    .spawn()?
                    .wait()?;

                Command::new("virsh")
                    .args([
                        "vol-delete",
                        "--pool",
                        "default",
                        &format!("{}-secondary.qcow2", &self.name),
                    ])
                    .spawn()?
                    .wait()?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub fn destroy(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["destroy", &self.name])
                    .spawn()?
                    .wait()?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub fn start(&self) -> anyhow::Result<()> {
        match self.machine_type {
            MachineType::LocalQemu => {
                Command::new("virsh")
                    .args(["start", &self.name])
                    .spawn()?
                    .wait()?;

                Ok(())
            }
            MachineType::Local => todo!(),
            MachineType::ExternalHetzner => todo!(),
        }
    }

    pub fn delete_all_mows_machines() -> anyhow::Result<()> {
        let output = Command::new("virsh").args(["list", "--all"]).output()?;
        let output = String::from_utf8(output.stdout)?;

        let lines: Vec<&str> = output.lines().collect();
        for line in lines {
            if line.contains("mows-") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                let name = some_or_bail!(parts.get(1), "No name found: name");
                let machine = Machine {
                    name: name.to_string(),
                    mac: None,
                    machine_type: MachineType::LocalQemu,
                };
                machine.delete()?;
            }
        }

        Ok(())
    }
}

fn qemu_get_mac_address(node_name: &str) -> anyhow::Result<String> {
    let output = Command::new("virsh")
        .args(["domiflist", node_name])
        .output()?;
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
