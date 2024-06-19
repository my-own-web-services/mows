use std::{collections::HashMap, net::IpAddr, path::Path, process::Output};

use anyhow::{bail, Context};
use tokio::{fs, process::Command};
use tracing::debug;
use tracing_subscriber::field::debug;

use crate::{
    config::{config, Cluster, ClusterNode, MachineInstallState, ManagerConfig, SshAccess},
    get_current_config_cloned, some_or_bail,
    utils::generate_id,
    write_config,
};

impl Cluster {
    pub async fn new() -> anyhow::Result<Self> {
        let encryption_key = generate_id(100);

        let k3s_token = generate_id(100);

        let kairos_version = "v2.5.0";
        let k3s_version = "k3sv1.29.0+k3s1";
        let os = "opensuse-tumbleweed";

        let mut cluster_nodes = HashMap::new();

        let cfg1 = config().read().await;

        let possible_machines = cfg1.machines.clone();
        drop(cfg1);

        let mut primary_hostname: Option<String> = None;

        for (i, (machine_name, machine)) in possible_machines.iter().enumerate() {
            let hostname = machine_name.clone();
            let ssh_access = SshAccess::new().await?;

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
                    ssh: ssh_access,
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
            let mut config = write_config!();

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

    /*
    Get the ip of the first reachable node
    */
    pub async fn get_ssh_reachable_node_ip(&self) -> anyhow::Result<IpAddr> {
        let config = get_current_config_cloned!();

        // TODO try the vip first

        for node in self.cluster_nodes.values() {
            if let Some(machine) = config.get_machine_by_id(&node.machine_id) {
                if node.ssh.exec(&machine, "echo", 2).await.is_ok() {
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
        if self.kubeconfig.is_some() {
            return Ok(self.kubeconfig.clone().unwrap());
        }
        let config = get_current_config_cloned!();

        for node in self.cluster_nodes.values() {
            if let Some(machine) = config.get_machine_by_id(&node.machine_id) {
                if let Some(install) = &machine.install {
                    if install.state == Some(MachineInstallState::Installed) {
                        match node.get_kubeconfig().await {
                            Ok(kc) => return Ok(kc),
                            Err(e) => debug!(
                                "Could not get kubeconfig for node: {} {:?}",
                                node.hostname, e
                            ),
                        }
                    } else {
                        debug!("Node {} not installed", node.hostname);
                    };
                } else {
                    debug!("Node {} not installed", node.hostname);
                };
            };
        }

        bail!("No installed nodes with kubeconfig found")
    }

    pub async fn write_local_kubeconfig(&self) -> anyhow::Result<()> {
        let kubeconfig_path = Path::new("/root/.kube/");

        let ip = self.get_ssh_reachable_node_ip().await?;

        let kubeconfig = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", ip));

        tokio::fs::create_dir_all(&kubeconfig_path).await?;

        tokio::fs::write(&kubeconfig_path.join("config"), kubeconfig).await?;

        Ok(())
    }

    pub async fn run_command_with_kubeconfig(
        &self,
        command: &mut Command,
    ) -> anyhow::Result<Output> {
        self.write_local_kubeconfig().await?;

        let out = command.spawn()?.wait_with_output().await?;
        Ok(out)
    }

    pub async fn install_basics(&self) -> anyhow::Result<()> {
        // install kube-vip
        {
            self.run_command_with_kubeconfig(Command::new("kubectl").args([
                "apply",
                "-f",
                "/install/cluster-basics/kube-vip/role.yml",
            ]))
            .await
            .context("Failed to install kube-vip cluster role")?;
            self.run_command_with_kubeconfig(Command::new("kubectl").args([
                "apply",
                "-f",
                "/install/cluster-basics/kube-vip/manifest.yml",
            ]))
            .await
            .context("Failed to install kube-vip manifest.")?;
        }

        // install storage: longhorn
        {
            let _ = Command::new("helm")
                .args(["repo", "add", "longhorn", "https://charts.longhorn.io"])
                .spawn()?
                .wait_with_output()
                .await;
            let _ = Command::new("helm")
                .args(["repo", "update"])
                .spawn()?
                .wait_with_output()
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

    pub async fn write_local_ssh_config(&self) -> anyhow::Result<()> {
        let config = get_current_config_cloned!();
        let ssh_config_path = Path::new("/root/.ssh/");

        let mut ssh_config_file = String::new();

        for node in self.cluster_nodes.values() {
            let machine = some_or_bail!(
                config.get_machine_by_id(&node.machine_id),
                "Machine not found"
            );
            let ip = machine.get_current_ip().await?;
            let val = format!(
                r#"
Host {}
    HostName {}
    User {}
    IdentityFile /id/{}
    "#,
                node.hostname, ip, node.ssh.ssh_username, node.hostname
            );

            ssh_config_file.push_str(&val);
        }

        fs::create_dir_all(ssh_config_path).await?;

        fs::write(ssh_config_path.join("config"), ssh_config_file).await?;

        Ok(())
    }

    pub async fn setup_local_ssh_access(&self) -> anyhow::Result<()> {
        for node in self.cluster_nodes.values() {
            node.add_ssh_key_to_local_agent().await?;
        }

        Ok(())
    }
}
