use std::process::Stdio;

use axum::extract::ws;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use utoipa::ToSchema;

use crate::{
    api::machines::MachineStatusResBody,
    config::{Machine, SshAccess},
    machines::{MachineStatus, MachineType, VncWebsocket},
    some_or_bail,
};

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct LocalMachineProviderQemuConfig {
    /**
     * Memory in GB
     */
    pub memory: u8,
    pub cpus: u8,
}

pub struct LocalMachineProviderQemu;

impl LocalMachineProviderQemu {
    pub async fn new(
        cc: &LocalMachineProviderQemuConfig,
        machine_name: &str,
    ) -> anyhow::Result<Machine> {
        let ssh = SshAccess::new(Some(machine_name.to_string()), None).await?;

        let primary_volume_name = format!("{}-ssd", machine_name);
        let primary_volume_size = 30;
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
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        let mac = qemu_get_mac_address(&machine_name).await?;

        let machine = Machine {
            id: machine_name.to_string(),
            machine_type: MachineType::LocalQemu,
            install: None,
            mac: Some(mac),
            ssh,
            public_ip: None,
            public_legacy_ip: None,
        };

        machine.force_off().await?;
        Ok(machine)
    }

    pub async fn get_infos(id: &str) -> anyhow::Result<serde_json::Value> {
        let output = Command::new("virsh").args(["dumpxml", id]).output().await?;
        let output = String::from_utf8(output.stdout)?;

        let xml: serde_json::Value = serde_xml_rs::from_str(&output)?;

        Ok(xml)
    }

    pub async fn get_vnc_websocket(id: &str) -> anyhow::Result<VncWebsocket> {
        let infos = Self::get_infos(id).await?;

        let ws_port = infos
            .get("devices")
            .and_then(|devices| devices.get("graphics"))
            .and_then(|graphics| graphics.get("websocket"))
            .and_then(|websocket| websocket.as_str())
            .ok_or_else(|| anyhow::anyhow!("No websocket found"))?;

        if ws_port == "-1" {
            return Err(anyhow::anyhow!("No websocket found"));
        }

        Ok(VncWebsocket {
            url: format!("ws://localhost:{}", ws_port),
            password: "".to_string(),
        })
    }

    pub async fn get_status(id: &str) -> anyhow::Result<MachineStatus> {
        let output = Command::new("virsh")
            .args(["domstate", id])
            .output()
            .await?;
        let output = String::from_utf8(output.stdout)?;

        Ok(match output.trim() {
            "running" => MachineStatus::Running,
            "shut off" => MachineStatus::Stopped,
            _ => MachineStatus::Unknown,
        })
    }

    pub async fn dev_delete_all() -> anyhow::Result<()> {
        // list all virtual machines
        let output = Command::new("virsh")
            .args(["list", "--all"])
            .output()
            .await?;
        let output = String::from_utf8(output.stdout)?;

        let lines: Vec<&str> = output.lines().collect();
        for line in lines {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() > 1 {
                let machine_name = parts[1];
                if machine_name.starts_with("mows-") {
                    Command::new("virsh")
                        .args(["destroy", machine_name])
                        .stdout(Stdio::null())
                        .spawn()?
                        .wait()
                        .await?;
                    Command::new("virsh")
                        .args(["undefine", machine_name])
                        .stdout(Stdio::null())
                        .spawn()?
                        .wait()
                        .await?;
                    Command::new("virsh")
                        .args([
                            "vol-delete",
                            "--pool",
                            "default",
                            &format!("{}-primary.qcow2", machine_name),
                        ])
                        .stdout(Stdio::null())
                        .spawn()?
                        .wait()
                        .await?;
                    Command::new("virsh")
                        .args([
                            "vol-delete",
                            "--pool",
                            "default",
                            &format!("{}-secondary.qcow2", machine_name),
                        ])
                        .stdout(Stdio::null())
                        .spawn()?
                        .wait()
                        .await?;
                }
            }
        }

        Ok(())
    }

    pub async fn delete(id: &str) -> anyhow::Result<()> {
        Command::new("virsh")
            .args(["destroy", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;
        Command::new("virsh")
            .args(["undefine", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Command::new("virsh")
            .args([
                "vol-delete",
                "--pool",
                "default",
                &format!("{}-primary.qcow2", id),
            ])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Command::new("virsh")
            .args([
                "vol-delete",
                "--pool",
                "default",
                &format!("{}-secondary.qcow2", id),
            ])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    pub async fn start(id: &str) -> anyhow::Result<()> {
        Command::new("virsh")
            .args(["start", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    pub async fn reboot(id: &str) -> anyhow::Result<()> {
        Command::new("virsh")
            .args(["reboot", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    pub async fn shutdown(id: &str) -> anyhow::Result<()> {
        Command::new("virsh")
            .args(["shutdown", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    pub async fn force_off(id: &str) -> anyhow::Result<()> {
        Command::new("virsh")
            .args(["destroy", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    pub async fn reset(id: &str) -> anyhow::Result<()> {
        Command::new("virsh")
            .args(["reset", id])
            .stdout(Stdio::null())
            .spawn()?
            .wait()
            .await?;

        Ok(())
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
