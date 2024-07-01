use std::io::Write;
use std::os::fd::{FromRawFd, RawFd};
use std::process::Stdio;
use std::{collections::HashMap, fs::Permissions, os::unix::fs::PermissionsExt, path::Path};

use crate::config::HelmDeploymentState;
use crate::utils::cmd;
use crate::{
    config::{Cluster, ClusterNode, MachineInstallState, ManagerConfig, SshAccess},
    get_current_config_cloned, some_or_bail,
    utils::generate_id,
    write_config,
};
use anyhow::{bail, Context};
use k8s_openapi::api::core::v1::Node;
use kube::{
    api::ListParams,
    config::{KubeConfigOptions, Kubeconfig},
    Api,
};
use serde_json::json;
use std::os::unix::io::AsRawFd;
use tempfile::NamedTempFile;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::sleep;
use tracing::debug;

use super::cluster_storage::ClusterStorage;

impl Cluster {
    #[tracing::instrument]
    pub async fn new() -> anyhow::Result<()> {
        let encryption_key = generate_id(100);

        let k3s_token = generate_id(100);

        let kairos_version = "v3.0.14";
        let k3s_version = "k3sv1.29.3+k3s1";
        let os = "opensuse-tumbleweed";

        let cluster_id = generate_id(8);

        let mut cluster_nodes = HashMap::new();

        debug!("Creating cluster: {}", cluster_id);

        let cfg1 = get_current_config_cloned!();

        let mut primary_hostname: Option<String> = None;

        for (i, (machine_name, machine)) in cfg1.machines.iter().enumerate() {
            if machine.install.is_some() {
                continue;
            }
            let hostname = machine_name.clone().to_lowercase();
            let ssh_access = SshAccess::new().await?;

            if i == 0 {
                primary_hostname = Some(hostname.clone());
            }

            machine
                .configure_install(
                    kairos_version,
                    k3s_version,
                    os,
                    &k3s_token,
                    &hostname,
                    &ssh_access,
                    &primary_hostname.clone().unwrap(),
                )
                .await?;

            cluster_nodes.insert(
                hostname.clone(),
                ClusterNode {
                    machine_id: machine_name.clone(),
                    hostname,
                    ssh: ssh_access,
                },
            );
        }

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

        let mut config = write_config!();

        config.clusters.insert(cluster_id.clone(), cluster.clone());

        drop(config);

        tokio::spawn(async move {
            let config = get_current_config_cloned!();
            cluster.start_machines(&config).await.unwrap();
            debug!("Cluster {} was created", cluster_id);
        });

        Ok(())
    }

    pub async fn start_machines(&self, config: &ManagerConfig) -> anyhow::Result<()> {
        debug!("Starting machines");
        for node in self.cluster_nodes.values() {
            debug!("Starting machine: {}", node.hostname);
            sleep(tokio::time::Duration::from_secs(3)).await;
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
        let node = some_or_bail!(self.cluster_nodes.values().next(), "No nodes found");

        let kc = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", node.hostname));

        let kc = Kubeconfig::from_yaml(&kc)?;

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

    pub async fn check_helm_deployment_state(
        deployment: &str,
        namespace: &str,
    ) -> anyhow::Result<HelmDeploymentState> {
        match cmd(
            vec!["helm", "status", deployment, "-n", namespace],
            "Failed to check if cilium is installed",
        )
        .await
        {
            Ok(v) => {
                if v.contains("STATUS: deployed") {
                    return Ok(HelmDeploymentState::Installed);
                } else {
                    return Ok(HelmDeploymentState::Requested);
                }
            }
            Err(e) => {
                // if the error includes release:not found, then cilium is not installed
                if e.to_string().contains("Error: release: not found") {
                    debug!("{} not installed", deployment);
                    return Ok(HelmDeploymentState::NotInstalled);
                };
                bail!(
                    "Failed to check if deployment {} is ready: {:?}",
                    deployment,
                    e
                );
            }
        }
    }

    pub async fn install_network(&self) -> anyhow::Result<()> {
        let name = "mows-network";

        // check if cilium is already installed
        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(()); // network is already installed
        }

        let cilium_version = "1.15.0";
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
                name,
                // chart
                "cilium/cilium",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                name,
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
                "hubble.enabled=true",
                //
                "--set",
                "kubeProxyReplacement=strict",
                //
                "--set",
                "k8sServiceHost=127.0.0.1",
                //
                "--set",
                "k8sServicePort=6443",
                //
                "--set",
                "externalIPs.enabled=true",
                //
                "--set",
                &format!("cluster.name={}", self.id),
                //
                "--set",
                "bgpControlPlane.enabled=true",
                //
                "--set",
                "l2announcements.enabled=true",
                //
                "--set",
                "k8sClientRateLimit.qps=32",
                //
                "--set",
                "k8sClientRateLimit.burst=64",
                //
                "--set",
                "gatewayAPI.enabled=true",
                //
                "--set",
                "operator.rollOutPods=true",
                //
                "--set",
                "rollOutCiliumPods=true",
                //
                "--set",
                "enableCiliumEndpointSlice=true",
                //
                "--set",
                "debug.enabled=true",
            ],
            "Failed to install cilium",
        )
        .await?;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/cluster-basics/network/resources.yml",
            ],
            "Failed to apply cilium network policy",
        )
        .await?;

        Ok(())
    }

    pub async fn install_kubevip(&self) -> anyhow::Result<()> {
        let vip = "192.168.112.99";
        let vip_interface = "enp1s0";
        // update the version by creating a new manifest with
        // bash scripts/generate-kube-vip-files.sh VERSION

        let template_manifest =
            fs::read_to_string("/install/cluster-basics/kube-vip/manifest.yml").await?;

        let mut manifest_tempfile =
            NamedTempFile::new().context("Failed to create temporary file")?;

        let manifest = template_manifest
            .replace("$$$VIP$$$", vip)
            .replace("$$$VIP_INTERFACE$$$", vip_interface);

        writeln!(manifest_tempfile, "{}", &manifest,)
            .context("Failed to write to temporary file")?;

        // create the mows-vip namespace

        let _ = cmd(
            vec!["kubectl", "create", "namespace", "mows-vip"],
            "Failed to install kube-vip namespace",
        )
        .await;

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

    pub async fn install_dashboard(&self) -> anyhow::Result<()> {
        let version = "6.0.8";
        let name = "kubernetes-dashboard";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing kubernetes-dashboard");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "kubernetes-dashboard",
                "https://kubernetes.github.io/dashboard/",
            ],
            "Failed to add kubernetes-dashboard helm repo",
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
                name,
                // chart
                "kubernetes-dashboard/kubernetes-dashboard",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                name,
                //
                "--version",
                version,
                //
                "--set",
                "metrics-server.enabled=false",
                //
                "--set",
                "cert-manager.enabled=true",
                //
                "--set",
                "app.ingress.enabled=true",
            ],
            "Failed to install kubernetes-dashboard",
        )
        .await?;

        let _ = cmd(
            vec![
                "kubectl",
                "delete",
                "clusterrolebindings.rbac.authorization.k8s.io kubernetes-dashboard",
            ],
            "Failed to delete kubernetes-dashboard clusterrolebindings",
        )
        .await;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/cluster-basics/dashboard/dashboard-admin.yml",
            ],
            "Failed to apply clusterrolebindings for dashboard",
        )
        .await?;

        debug!("Kubernetes dashboard installed");

        Ok(())
    }

    pub async fn install_local_ingress(&self) -> anyhow::Result<()> {
        let version = "28.3.0";
        let name = "mows-ingress";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing traefik ingress");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "traefik",
                "https://traefik.github.io/charts",
            ],
            "Failed to add traefik helm repo",
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
                name,
                // chart
                "traefik/traefik",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                name,
                //
                "--version",
                version,
                //
                "--set",
                "additional.sendAnonymousUsage=false",
                //use this values file
                "--set",
                "'service.annotations.\"io\\.cilium/lb-ipam-ips\"=192.168.112.50'",
            ],
            "Failed to install traefik",
        )
        .await?;

        debug!("Traefik ingress installed");

        Ok(())
    }

    pub async fn install_with_kustomize(&self, generation: u8) -> anyhow::Result<()> {
        let output = Command::new("kubectl")
            .args(vec![
                "kustomize",
                "--enable-helm",
                &format!("/install/{}/network/", generation),
            ])
            .output()
            .await
            .context("Failed to run kubectl kustomize")?;

        // kubectl apply -f -
        let mut kubectl_apply = Command::new("kubectl")
            .args(vec!["apply", "-f", "-"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
            .context("Failed to run kubectl apply")?;

        let stdin = kubectl_apply
            .stdin
            .as_mut()
            .context("Failed to open stdin")?;

        stdin
            .write_all(&output.stdout)
            .await
            .context("Failed to write to stdin")?;

        let _ = kubectl_apply
            .wait_with_output()
            .await
            .context("Failed to wait for kubectl apply")?;

        Ok(())
    }

    pub async fn install_basics(&self) -> anyhow::Result<()> {
        self.write_local_kubeconfig().await?;

        self.install_network().await?;

        //self.install_with_kustomize(0).await?;

        //self.install_kubevip().await?;

        ClusterStorage::install(&self).await?;

        self.install_dashboard().await?;

        self.install_local_ingress().await?;

        // install ingress: traefik

        // install application-manager: mows-controller

        // optional for now
        // install lightweight virtual runtime: kata
        // install full virtual runtime: kubevirt
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

    pub async fn start_proxy(&self) -> anyhow::Result<()> {
        cmd(
            vec!["kubectl", "proxy", "--address", "0.0.0.0"],
            "Failed to start kubectl proxy",
        )
        .await?;

        Ok(())
    }
}
