use std::{borrow::BorrowMut, collections::HashMap, fs, sync::Arc};

use anyhow::bail;
use serde::{Deserialize, Serialize};
use tokio::{process::Command, sync::Mutex};
use utoipa::ToSchema;

use crate::{
    config::{Cluster, ClusterNode, Config, InstallState, SshAccess},
    some_or_bail,
    utils::generate_id,
};

impl Cluster {
    pub async fn new(config: Arc<Mutex<Config>>) -> anyhow::Result<Self> {
        let mut config = config.lock().await;

        let encryption_key = generate_id(100);

        let k3s_token = generate_id(100);

        let kairos_version = "v2.5.0";
        let k3s_version = "k3sv1.29.0+k3s1";
        let os = "opensuse-tumbleweed";

        //let mut pxe = Pxe::new("v2.5.0", "k3sv1.29.0+k3s1", "opensuse-tumbleweed")?;

        //let cluster_nodes = pxe.install_cluster(machines.clone()).await?;

        let mut cluster_nodes = HashMap::new();

        let machines_to_install = config.machines.borrow_mut();

        for (i, (machine_name, machine)) in machines_to_install.iter_mut().enumerate() {
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
                    i == 0,
                )
                .await?;

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
        };

        config.clusters.insert(cluster_id, cluster.clone());

        Ok(cluster)
    }

    pub async fn get_kubeconfig(&self, config: &Config) -> anyhow::Result<String> {
        let mut selected_node: Option<ClusterNode> = None;

        for node in self.cluster_nodes.values() {
            match config.get_machine_by_name(&node.machine_id) {
                Some(machine) => match machine.install {
                    Some(install) => match install.state {
                        Some(InstallState::Installed) => {
                            selected_node = Some(node.clone());
                            break;
                        }
                        _ => None::<()>,
                    },
                    None => None::<()>,
                },
                None => None::<()>,
            };
        }

        match selected_node {
            Some(node) => node.get_kubeconfig(config).await,
            None => bail!("No installed nodes found"),
        }
    }

    pub async fn run_kube_cluster_command(&self, command: &mut Command) -> anyhow::Result<String> {
        let kubectl_path = "~/.kube/config";
        let kubeconfig = some_or_bail!(self.kubeconfig.clone(), "No kubeconfig found");
        fs::write(kubectl_path, kubeconfig)?;

        let output = match command.output().await {
            Ok(v) => v,
            Err(e) => {
                fs::remove_file(kubectl_path)?;
                bail!(e)
            }
        };

        fs::remove_file(kubectl_path)?;

        if !output.status.success() {
            bail!(
                "Failed to run command: {}",
                String::from_utf8_lossy(&output.stderr)
            )
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    pub async fn install_basics() -> anyhow::Result<()> {
        // install kube-vip

        // install storage: longhorn

        // install network: cilium

        // install lightweight virtual runtime: kata

        // install full virtual runtime: kubevirt

        // install dashboard

        // install ingress: traefik

        // install application-manager: mows-controller

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterCreationConfig {}
