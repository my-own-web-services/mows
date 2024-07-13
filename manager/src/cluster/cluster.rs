use std::io::Write;
use std::net::Ipv4Addr;
use std::process::Stdio;
use std::{collections::HashMap, fs::Permissions, os::unix::fs::PermissionsExt, path::Path};

use crate::config::{HelmDeploymentState, InternalIps, Vip, VipIp};
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
use tempfile::NamedTempFile;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::sleep;
use tracing::debug;

use super::db::ClusterDatabases;
use super::ingress::ClusterLocalIngress;
use super::monitoring::ClusterMonitoring;
use super::network::ClusterNetwork;
use super::policy::ClusterPolicy;
use super::storage::ClusterStorage;

impl Cluster {
    #[tracing::instrument]
    pub async fn new() -> anyhow::Result<()> {
        let encryption_key = generate_id(100);

        let k3s_token = generate_id(100);

        let kairos_version = "v3.0.14";
        let k3s_version = "k3sv1.29.3+k3s1";
        let os = "opensuse-tumbleweed";

        let cluster_id = generate_id(8).to_lowercase();

        let vip = Vip {
            controlplane: VipIp {
                legacy_ip: Some(Ipv4Addr::new(192, 168, 112, 254)),
                ip: None,
            },
            service: VipIp {
                legacy_ip: Some(Ipv4Addr::new(192, 168, 112, 253)),
                ip: None,
            },
        };

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

            let internal_ips = InternalIps {
                legacy: Ipv4Addr::new(10, 41, 0, 1 + i as u8),
            };

            machine
                .configure_install(
                    kairos_version,
                    k3s_version,
                    os,
                    &k3s_token,
                    &hostname,
                    &ssh_access,
                    &primary_hostname.clone().unwrap(),
                    &vip,
                    &internal_ips,
                )
                .await?;

            cluster_nodes.insert(
                hostname.clone(),
                ClusterNode {
                    machine_id: machine_name.clone(),
                    hostname,
                    ssh: ssh_access,
                    internal_ips,
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
            vip,
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

        let hostname = if let Ok(v) = self.controlplane_vip_is_ready().await {
            v
        } else {
            node.hostname.clone()
        };

        let kubeconfig = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", hostname));

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

        let hostname = if let Ok(v) = self.controlplane_vip_is_ready().await {
            v
        } else {
            node.hostname.clone()
        };

        let kc = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", hostname));

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

    pub async fn controlplane_vip_is_ready(&self) -> anyhow::Result<String> {
        // check if we can reach the kube api server on th control plane vip, we should get unauthorized, we use reqwest for this
        let vip = some_or_bail!(&self.vip.controlplane.legacy_ip, "No controlplane vip");

        let url = format!("https://{}:6443", vip);

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()?;

        let res = client.get(&url).send().await?;

        if res.status() == reqwest::StatusCode::UNAUTHORIZED {
            Ok(vip.to_string())
        } else {
            bail!("Controlplane vip is not ready")
        }
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
                "/install/core-apis/dashboard/dashboard-admin.yml",
            ],
            "Failed to apply clusterrolebindings for dashboard",
        )
        .await?;

        debug!("Kubernetes dashboard installed");

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

    pub async fn create_namespaces() -> anyhow::Result<()> {
        debug!("Creating namespaces");

        Namespace::new("mows-network", true, "core").await?;
        Namespace::new("mows-monitoring", false, "core").await?;
        Namespace::new("mows-storage", true, "core").await?;
        Namespace::new("mows-vip", true, "core").await?;
        Namespace::new("mows-ingress", false, "core").await?;
        Namespace::new("mows-db-pg", false, "core").await?;
        Namespace::new("kubernetes-dashboard", false, "dev").await?;
        Namespace::new("mows-police", false, "core").await?;

        debug!("Namespaces created");

        Ok(())
    }

    pub async fn install_basics(&self) -> anyhow::Result<()> {
        self.write_local_kubeconfig().await?;

        Self::create_namespaces().await?;

        self.install_dashboard().await?;

        ClusterNetwork::install(&self).await?;

        ClusterMonitoring::install(&self).await?;

        ClusterPolicy::install().await?;

        ClusterLocalIngress::install(&self).await?;

        ClusterStorage::install(&self).await?;

        ClusterDatabases::install(&self).await?;

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

    pub async fn start_proxy() -> anyhow::Result<()> {
        debug!("Starting kubectl proxy");

        Command::new("kubectl")
            .args(vec!["proxy", "--address", "0.0.0.0"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start kubectl proxy")?;

        Ok(())
    }

    pub async fn stop_proxy() -> anyhow::Result<()> {
        debug!("Stopping kubectl proxy");
        cmd(
            vec!["pkill", "-f", "kubectl proxy"],
            "Failed to stop kubectl proxy",
        )
        .await?;
        Ok(())
    }
}

pub struct Namespace {
    pub name: String,
    pub disable_policy_enforcement: bool,
    pub core: bool,
}

impl Namespace {
    pub async fn new(
        name: &str,
        disable_policy_enforcement: bool,
        mows_api_type: &str,
    ) -> anyhow::Result<()> {
        let content = format!(
            r#"
apiVersion: v1
kind: Namespace
metadata:
    name: {}
    labels:
        mows-api: {}
        mows-core-apis-disable-kyverno: "{}"
"#,
            name, mows_api_type, disable_policy_enforcement
        );

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file")?;

        writeln!(tempfile, "{}", content).context("Failed to write namespace file")?;

        cmd(
            vec!["kubectl", "apply", "-f", tempfile.path().to_str().unwrap()],
            "Failed to create namespace",
        )
        .await?;

        Ok(())
    }
}
