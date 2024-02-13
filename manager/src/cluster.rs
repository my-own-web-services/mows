use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    config::{Cluster, Machine},
    pxe::Pxe,
    utils::generate_id,
};

impl Cluster {
    pub async fn new(machines: &HashMap<String, Machine>) -> anyhow::Result<Self> {
        let encryption_key = generate_id(100);

        let mut pxe = Pxe::new("v2.5.0", "k3sv1.29.0+k3s1", "opensuse-tumbleweed")?;

        let cluster_nodes = pxe.install_cluster(machines.clone()).await?;

        Ok(Self {
            cluster_nodes,
            kubeconfig: None,
            k3s_token: Some(pxe.k3s_token.clone()),
            encryption_key: Some(encryption_key),
            backup_nodes: HashMap::new(),
            public_ip_config: None,
            cluster_backup_wg_private_key: None,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterCreationConfig {}
