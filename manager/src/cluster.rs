use std::io::Write;
use std::{collections::HashMap, fs::Permissions, os::unix::fs::PermissionsExt, path::Path};

use anyhow::{bail, Context};
use k8s_openapi::api::core::v1::Node;
use kube::{
    api::ListParams,
    config::{KubeConfigOptions, Kubeconfig},
    Api,
};
use tempfile::NamedTempFile;
use tokio::fs;
use tracing::debug;

use crate::utils::cmd;
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
            let hostname = machine_name.clone().to_lowercase();
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
        let kubeconfig_directory = Path::new("/root/.kube/");
        let kubeconfig_path = kubeconfig_directory.join("config");

        let node = some_or_bail!(self.cluster_nodes.values().next(), "No nodes found");

        let kubeconfig = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", node.hostname));

        tokio::fs::create_dir_all(&kubeconfig_directory)
            .await
            .context(format!(
                "Failed to create kubeconfig directory: {:?}",
                kubeconfig_directory
            ))?;

        tokio::fs::write(&kubeconfig_path, kubeconfig)
            .await
            .context(format!(
                "Failed to write kubeconfig to: {:?}",
                kubeconfig_path
            ))?;

        tokio::fs::set_permissions(&kubeconfig_path, Permissions::from_mode(0o600))
            .await
            .context(format!(
                "Failed to set permissions on kubeconfig: {:?}",
                kubeconfig_path
            ))?;

        Ok(())
    }

    pub async fn get_kubeconfig_struct(&self) -> anyhow::Result<kube::Config> {
        let kc = some_or_bail!(&self.kubeconfig, "No kubeconfig found");

        let kc = Kubeconfig::from_yaml(kc)?;

        Ok(kube::Config::from_custom_kubeconfig(kc, &KubeConfigOptions::default()).await?)
    }

    pub async fn are_nodes_ready(&self) -> anyhow::Result<bool> {
        let kc = self.get_kubeconfig_struct().await?;
        let client = kube::client::Client::try_from(kc)?;

        let nodes: Api<Node> = Api::all(client);

        let ready = nodes
            .list(&ListParams::default())
            .await?
            .items
            .iter()
            .all(|node| {
                node.status
                    .as_ref()
                    .and_then(|status| status.conditions.as_ref())
                    .and_then(|conditions| {
                        Some(conditions.iter().any(|condition| {
                            condition.type_ == "Ready" && condition.status == "True"
                        }))
                    })
                    .unwrap_or(false)
            });

        Ok(ready)
    }

    pub async fn install_network(&self) -> anyhow::Result<()> {
        let cilium_version = "1.15.6";
        cmd(
            vec!["helm", "repo", "add", "cilium", "https://helm.cilium.io/"],
            "Failed to add cilium helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                "mows-network",
                // chart
                "cilium/cilium",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                "mows-network",
                //
                "--version",
                cilium_version,
                //
                "--set",
                "operator.replicas=1",
                //
                "--set",
                "hubble.relay.enabled=true",
                //
                "--set",
                "hubble.ui.enabled=true",
                //
                "--set",
                "global.kubeProxyReplacement='strict'",
                //
                "--set",
                "global.containerRuntime.integration='containerd'",
                //
                "--set",
                "global.containerRuntime.socketPath='/var/run/k3s/containerd/containerd.sock'",
                //
                "--set",
                "k8sServiceHost=127.0.0.1",
                //
                "--set",
                "k8sServicePort=6443",
            ],
            "Failed to install cilium",
        )
        .await?;

        Ok(())
    }

    pub async fn install_kubevip(&self) -> anyhow::Result<()> {
        let vip = "192.168.122.99";
        let vip_interface = "enp2s0";
        let kubevip_version = "0.4.0";
        todo!("update version");

        let template_manifest =
            fs::read_to_string("/install/cluster-basics/kube-vip/manifest.yml").await?;

        let mut manifest_tempfile =
            NamedTempFile::new().context("Failed to create temporary file")?;

        let manifest = template_manifest
            .replace("$$$VIP$$$", vip)
            .replace("$$$VIP_INTERFACE$$$", vip_interface)
            .replace("$$$KUBE_VIP_VERSION$$$", kubevip_version);

        writeln!(manifest_tempfile, "{}", &manifest,)
            .context("Failed to write to temporary file")?;

        // create the mows-vip namespace

        cmd(
            vec!["kubectl", "create", "namespace", "mows-vip"],
            "Failed to install kube-vip namespace",
        )
        .await?;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/cluster-basics/kube-vip/cluster-role.yml",
            ],
            "Failed to install kube-vip cluster role",
        )
        .await?;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                some_or_bail!(manifest_tempfile.path().to_str(), "No path"),
            ],
            "Failed to install kube-vip manifest",
        )
        .await?;

        Ok(())
    }

    pub async fn install_storage(&self) -> anyhow::Result<()> {
        let longhorn_version = "1.6.2";
        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "longhorn",
                "https://charts.longhorn.io",
            ],
            "Failed to add storage/longhorn helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                "mows-storage",
                // chart
                "longhorn/longhorn",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                "mows-storage",
                //
                "--version",
                longhorn_version,
                //
                "--set",
                "defaultSettings.createDefaultDiskLabeledNodes=true",
            ],
            "Failed to install storage/longhorn",
        )
        .await?;

        Ok(())
    }

    pub async fn install_basics(&self) -> anyhow::Result<()> {
        self.write_local_kubeconfig().await?;

        self.install_network().await?;

        self.install_kubevip().await?;

        self.install_storage().await?;

        // kubectl proxy --address 0.0.0.0

        // install lightweight virtual runtime: kata

        // install full virtual runtime: kubevirt

        // install dashboard

        // install ingress: traefik

        // install application-manager: mows-controller

        // install cert-manager?

        // install dns server

        Ok(())
    }

    pub async fn write_known_hosts(&self) -> anyhow::Result<()> {
        let known_hosts_path = Path::new("/root/.ssh/");

        let mut known_hosts_file = String::new();

        for node in self.cluster_nodes.values() {
            if let Some(remote_pub_key) = &node.ssh.remote_public_key {
                let val = format!("{} ssh-ed25519 {}\n", node.hostname, remote_pub_key);

                known_hosts_file.push_str(&val);
            }
        }

        fs::create_dir_all(known_hosts_path)
            .await
            .context("Failed to create known_hosts directory")?;

        fs::write(known_hosts_path.join("known_hosts"), known_hosts_file)
            .await
            .context("Failed to write known_hosts")?;

        Ok(())
    }

    pub async fn write_local_ssh_config(&self) -> anyhow::Result<()> {
        let ssh_config_path = Path::new("/root/.ssh/");

        let mut ssh_config_file = String::new();

        for node in self.cluster_nodes.values() {
            let val = format!(
                r#"
Host {}
    User {}
    IdentityFile /id/{}
    "#,
                node.hostname, node.ssh.ssh_username, node.hostname
            );

            ssh_config_file.push_str(&val);
        }

        fs::create_dir_all(ssh_config_path)
            .await
            .context("Failed to create ssh config directory")?;

        fs::write(ssh_config_path.join("config"), ssh_config_file)
            .await
            .context("Failed to write ssh config")?;

        Ok(())
    }

    pub async fn setup_local_ssh_access(&self) -> anyhow::Result<()> {
        for node in self.cluster_nodes.values() {
            node.ssh
                .add_ssh_key_to_local_agent()
                .await
                .context(format!(
                    "Failed to add ssh key to local agent for node {}",
                    node.hostname
                ))?;
        }

        self.write_local_ssh_config()
            .await
            .context("Failed to write local ssh config")?;

        self.write_known_hosts()
            .await
            .context("Failed to write known hosts")?;

        Ok(())
    }
}
