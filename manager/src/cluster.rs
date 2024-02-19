use std::{borrow::BorrowMut, collections::HashMap, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use utoipa::ToSchema;

use crate::{
    config::{Cluster, ClusterNode, Config, SshAccess},
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
            machine.configure_install(
                kairos_version,
                k3s_version,
                os,
                &k3s_token,
                &hostname,
                &ssh_access,
                i == 0,
            )?;

            cluster_nodes.insert(
                hostname.clone(),
                ClusterNode {
                    machine_name: machine_name.clone(),
                    hostname,
                    ssh_access,
                },
            );
        }

        let cluster = Self {
            cluster_nodes,
            kubeconfig: None,
            k3s_token,
            encryption_key: Some(encryption_key),
            backup_nodes: HashMap::new(),
            public_ip_config: None,
            cluster_backup_wg_private_key: None,
        };

        config.clusters.insert(generate_id(8), cluster.clone());

        Ok(cluster)
    }

    pub async fn get_kubeconfig(&mut self) -> anyhow::Result<()> {
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterCreationConfig {}
