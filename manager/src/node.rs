use anyhow::bail;

use crate::{config::ClusterNode, some_or_bail, utils::CONFIG};

impl ClusterNode {
    pub async fn get_kubeconfig(&self) -> anyhow::Result<String> {
        let config = CONFIG.read_err().await?;
        let machine = some_or_bail!(
            config.get_machine_by_id(&self.machine_id),
            format!("Machine with id: {} not found", self.machine_id)
        );
        drop(config);

        let res = self
            .ssh_access
            .exec(&machine, "sudo cat /etc/rancher/k3s/k3s.yaml", 5)
            .await?;

        if res.is_empty() {
            bail!("Kubeconfig is empty")
        }

        if !res.contains("apiVersion") {
            bail!("Kubeconfig is invalid")
        }
        Ok(res)
    }
}
