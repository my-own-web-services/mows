use std::io::Write;
use std::net::Ipv4Addr;
use std::process::Stdio;
use std::{collections::HashMap, fs::Permissions, os::unix::fs::PermissionsExt, path::Path};

use crate::config::{HelmDeploymentState, Vip, VipIp};
use crate::internal_config::INTERNAL_CONFIG;
use crate::s;
use crate::utils::cmd;
use crate::{
    config::{Cluster, MachineInstallState, ManagerConfig},
    get_current_config_cloned, some_or_bail,
    utils::generate_id,
};
use anyhow::{bail, Context};
use k8s_openapi::api::core::v1::Node;
use kube::{
    api::ListParams,
    config::{KubeConfigOptions, Kubeconfig},
    Api,
};
use tempfile::NamedTempFile;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::sleep;
use tracing::{debug, warn};

use super::network::ClusterNetwork;
use super::secrets::ClusterSecrets;
use super::storage::ClusterStorage;

impl Cluster {
    #[tracing::instrument]
    pub async fn new() -> anyhow::Result<Cluster> {
        let encryption_key = generate_id(100);

        let k3s_token = generate_id(100);

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

        debug!("Creating cluster: {}", cluster_id);

        Ok(Self {
            id: cluster_id.clone(),
            cluster_nodes: HashMap::new(),
            kubeconfig: None,
            k3s_token,
            encryption_key: Some(encryption_key),
            backup_nodes: HashMap::new(),
            public_ip_config: HashMap::new(),
            cluster_backup_wg_private_key: None,
            install_state: None,
            vip,
            vault_secrets: None,
        })
    }

    pub async fn start_all_machines(&self, config: &ManagerConfig) -> anyhow::Result<()> {
        debug!("Starting machines");
        for node in self.cluster_nodes.values() {
            debug!("Starting machine: {}", node.machine_id);
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
                                node.machine_id, e
                            ),
                        }
                    } else {
                        debug!("Node {} not installed", node.machine_id);
                    };
                } else {
                    debug!("Node {} not installed", node.machine_id);
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
            node.machine_id.clone()
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
            node.machine_id.clone()
        };

        let kc = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found")
            .replace("https://127.0.0.1", &format!("https://{}", hostname));

        let kc = Kubeconfig::from_yaml(&kc)?;

        Ok(kube::Config::from_custom_kubeconfig(kc, &KubeConfigOptions::default()).await?)
    }

    pub async fn get_kube_client(&self) -> anyhow::Result<kube::client::Client> {
        let kc = self.get_kubeconfig_struct().await?;
        Ok(kube::client::Client::try_from(kc)?)
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
            "Failed to check if deployment is installed",
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
        debug!("Installing k8s dashboard");

        Self::install_with_kustomize("/install/dev/k8s-dashboard/").await?;

        debug!("K8s dashboard installed");

        Ok(())
    }

    pub async fn install_argocd(&self) -> anyhow::Result<()> {
        debug!("Installing argocd");

        Self::install_with_kustomize("/install/core/argocd/").await?;

        debug!("Argocd installed");

        Ok(())
    }

    pub async fn install_with_kustomize(path: &str) -> anyhow::Result<()> {
        let output = Command::new("kubectl")
            .args(vec!["kustomize", "--enable-helm", &path])
            .output()
            .await
            .context("Failed to run kubectl kustomize")?;

        // kubectl apply -f -
        let mut kubectl_apply = Command::new("kubectl")
            .args(vec!["apply", "--server-side", "-f", "-"])
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

    pub async fn install_core_cloud_system(&self) -> anyhow::Result<()> {
        let ic = &INTERNAL_CONFIG;

        self.write_local_kubeconfig().await?;

        if ic.dev.enabled && ic.dev.install_k8s_dashboard {
            self.install_dashboard().await?;
        }

        if ic.dev.enabled && ic.dev.skip_core_components_install.contains(&s!("network")) {
            warn!("Skipping network install as configured in internal config");
        } else {
            ClusterNetwork::install().await?;
        }

        if ic.dev.enabled && ic.dev.skip_core_components_install.contains(&s!("storage")) {
            warn!("Skipping storage install as configured in internal config");
        } else {
            ClusterStorage::install(&self).await?;
        }

        if ic.dev.enabled && ic.dev.skip_core_components_install.contains(&s!("argocd")) {
            warn!("Skipping argocd install as configured in internal config");
        } else {
            Self::install_argocd(&self).await?;

            Self::install_core_with_argo(&self).await?;
        }

        if ic.dev.enabled && ic.dev.skip_core_components_install.contains(&s!("vault")) {
            warn!("Skipping vault install as configured in internal config");
        } else {
            if let Err(e) = ClusterSecrets::setup_vault(&self).await {
                if !e.to_string().contains("Vault is already initialized") {
                    bail!(e);
                }
            }
        }

        if ic.dev.enabled && ic.dev.skip_core_components_install.contains(&s!("vrc")) {
            warn!("Skipping vrc install as configured in internal config");
        } else {
            ClusterSecrets::start_proxy_and_setup_vrc(&self).await?;
        }

        Ok(())
    }

    pub async fn install_core_with_argo(&self) -> anyhow::Result<()> {
        debug!("Installing core apps");
        Self::install_with_kustomize("/install/argocd/core").await?;
        debug!("Core apps installed");
        Ok(())
    }

    pub async fn start_kubectl_proxy() -> anyhow::Result<()> {
        debug!("Starting kubectl proxy");

        Command::new("kubectl")
            .args(vec!["proxy", "--address", "0.0.0.0"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start kubectl proxy")?;

        Ok(())
    }

    pub async fn stop_kubectl_proxy() -> anyhow::Result<()> {
        debug!("Stopping kubectl proxy");
        cmd(
            vec!["pkill", "-f", "kubectl proxy"],
            "Failed to stop kubectl proxy",
        )
        .await?;
        Ok(())
    }

    pub async fn start_kubectl_port_forward(
        namespace: &str,
        // target is the pod or service name prefixed service/NAME_OF_SERVICE
        target: &str,
        local_port: u16,
        remote_port: u16,
        exposed_outside_container: bool,
    ) -> anyhow::Result<()> {
        debug!("Starting kubectl port-forward");

        Command::new("kubectl")
            .args(vec![
                "port-forward",
                target,
                "-n",
                namespace,
                &format!("{}:{}", local_port, remote_port),
                &format!(
                    "--address={}",
                    if exposed_outside_container {
                        "0.0.0.0"
                    } else {
                        "127.0.0.1"
                    }
                ),
            ])
            .stdout(Stdio::null())
            .spawn()
            .context("Failed to start kubectl port-forward")?;

        Ok(())
    }

    pub async fn stop_kubectl_port_forward(namespace: &str, target: &str) -> anyhow::Result<()> {
        debug!("Stopping kubectl port-forward");
        cmd(
            vec![
                "pkill",
                "-f",
                &format!("kubectl port-forward {} -n {}", target, namespace),
            ],
            "Failed to stop kubectl port-forward",
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
        mows.cloud/api-type: {}
        mows.cloud/core-apis-disable-kyverno: "{}"
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
