use std::{collections::HashMap, net::IpAddr};

use anyhow::bail;
use tokio::{fs, process::Command};

use crate::{
    config::{Cluster, ClusterNode, MachineInstallState, ManagerConfig, SshAccess},
    get_current_config_cloned, some_or_bail,
    utils::{generate_id, CONFIG},
};

impl Cluster {
    pub async fn new() -> anyhow::Result<Self> {
        let encryption_key = generate_id(100);

        let k3s_token = generate_id(100);

        let kairos_version = "v2.5.0";
        let k3s_version = "k3sv1.29.0+k3s1";
        let os = "opensuse-tumbleweed";

        let mut cluster_nodes = HashMap::new();

        let cfg1 = CONFIG.read_err().await?;

        let possible_machines = cfg1.machines.clone();
        drop(cfg1);

        let mut primary_hostname: Option<String> = None;

        for (i, (machine_name, machine)) in possible_machines.iter().enumerate() {
            let hostname = machine_name.clone();
            let ssh_access = SshAccess::new()?;

            machine
                .configure_install(
                    kairos_version,
                    k3s_version,
                    os,
                    &k3s_token,
                    &hostname,
                    &ssh_access,
                    &primary_hostname,
                )
                .await?;

            if i == 0 {
                primary_hostname = Some(hostname.clone());
            }

            cluster_nodes.insert(
                hostname.clone(),
                ClusterNode {
                    machine_id: machine_name.clone(),
                    hostname,
                    ssh_access,
                },
            );
        }

        let cluster_id = generate_id(8);

        let cluster = Self {
            id: cluster_id.clone(),
            cluster_nodes,
            kubeconfig: None,
            k3s_token,
            encryption_key: Some(encryption_key),
            backup_nodes: HashMap::new(),
            public_ip_config: None,
            cluster_backup_wg_private_key: None,
            install_state: None,
        };
        {
            let mut config = CONFIG.write_err().await?;

            config.clusters.insert(cluster_id, cluster.clone());
        }

        let config = get_current_config_cloned!();

        cluster.start_machines(&config).await?;

        Ok(cluster)
    }

    pub async fn start_machines(&self, config: &ManagerConfig) -> anyhow::Result<()> {
        for node in self.cluster_nodes.values() {
            match config.get_machine_by_id(&node.machine_id) {
                Some(machine) => machine.start().await?,
                None => bail!("Machine not found"),
            }
        }

        Ok(())
    }

    pub async fn get_reachable_node_ip(&self) -> anyhow::Result<IpAddr> {
        let config = get_current_config_cloned!();

        // TODO try the vip first

        for node in self.cluster_nodes.values() {
            if let Some(machine) = config.get_machine_by_id(&node.machine_id) {
                if node.ssh_access.exec(&machine, "echo", 2).await.is_ok() {
                    match machine.last_ip {
                        Some(ip) => return Ok(ip),
                        None => bail!("No ip found"),
                    }
                }
            };
        }

        bail!("No reachable node found")
    }

    pub async fn get_kubeconfig(&self) -> anyhow::Result<String> {
        let config = get_current_config_cloned!();

        for node in self.cluster_nodes.values() {
            if let Some(machine) = config.get_machine_by_id(&node.machine_id) {
                if let Some(install) = &machine.install {
                    if install.state == Some(MachineInstallState::Installed) {
                        if let Ok(kc) = node.get_kubeconfig().await {
                            return Ok(kc);
                        }
                    }
                }
            };
        }

        bail!("No installed nodes with kubeconfig found")
    }

    pub async fn write_kubeconfig(&self) -> anyhow::Result<()> {
        let kubeconfig_path = "~/.kube/config";

        let ip = self.get_reachable_node_ip().await?;

        let kubeconfig = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", ip));
        std::fs::write(&kubeconfig_path, kubeconfig)?;

        Ok(())
    }

    pub async fn run_command_with_kubeconfig(
        &self,
        command: &mut Command,
    ) -> anyhow::Result<String> {
        self.write_kubeconfig().await?;

        let output = match command.output().await {
            Ok(v) => v,
            Err(e) => {
                bail!(e)
            }
        };

        if !output.status.success() {
            bail!(
                "Failed to run command: {}",
                String::from_utf8_lossy(&output.stderr)
            )
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    pub async fn install_basics(&self) -> anyhow::Result<()> {
        // install kube-vip

        {
            let _ = self
                .run_command_with_kubeconfig(Command::new("kubectl").args([
                    "apply",
                    "-f",
                    "/install/cluster-basics/kube-vip/role.yml",
                ]))
                .await;
            let _ = self
                .run_command_with_kubeconfig(Command::new("kubectl").args([
                    "apply",
                    "-f",
                    "/install/cluster-basics/kube-vip/manifest.yml",
                ]))
                .await;
        }

        // install storage: longhorn
        {
            let _ = Command::new("helm")
                .args(["repo", "add", "longhorn", "https://charts.longhorn.io"])
                .spawn()?
                .wait()
                .await;
            let _ = Command::new("helm")
                .args(["repo", "update"])
                .spawn()?
                .wait()
                .await;
            let _ = self
                .run_command_with_kubeconfig(Command::new("helm").args([
                    "upgrade",
                    "longhorn/longhorn",
                    "--install",
                    "longhorn",
                    "--namespace",
                    "longhorn-system",
                    "--create-namespace",
                    "--version",
                    "1.5.3",
                    "--set",
                    "defaultSettings.createDefaultDiskLabeledNodes=true",
                ]))
                .await;
        }

        // install network: cilium
        {
            let _ = Command::new("helm")
                .args(["repo", "add", "cilium", "https://helm.cilium.io/"])
                .spawn()?
                .wait()
                .await;
            let _ = Command::new("helm")
                .args(["repo", "update"])
                .spawn()?
                .wait()
                .await;
            let _ = self
                .run_command_with_kubeconfig(Command::new("helm").args([
                    "upgrade",
                    "cilium/cilium",
                    "--install",
                    "cilium",
                    "--namespace",
                    "cilium",
                    "--create-namespace",
                    "--version",
                    "1.15.0",
                    "--set",
                    "operator.replicas=1",
                    "--set",
                    "hubble.relay.enabled=true",
                    "--set",
                    "hubble.ui.enabled=true",
                ]))
                .await;
        }

        // install lightweight virtual runtime: kata

        // install full virtual runtime: kubevirt

        // install dashboard

        // install ingress: traefik

        // install application-manager: mows-controller

        // install cert-manager?

        // install dns server

        Ok(())
    }
}
