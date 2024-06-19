use anyhow::bail;

use crate::{config::ClusterNode, get_current_config_cloned, some_or_bail};

impl ClusterNode {
    pub async fn get_kubeconfig(&self) -> anyhow::Result<String> {
        let config = get_current_config_cloned!();
        let machine = some_or_bail!(
            config.get_machine_by_id(&self.machine_id),
            format!("Machine with id: {} not found", self.machine_id)
        );

        let res = self
            .ssh
            .exec(&machine, "sudo cat /etc/rancher/k3s/k3s.yaml", 2)
            .await?;

        if res.is_empty() {
            bail!("Kubeconfig is empty")
        }

        if !res.contains("apiVersion") {
            bail!("Kubeconfig is invalid")
        }
        Ok(res)
    }

    pub async fn add_ssh_key_to_local_agent(&self) -> anyhow::Result<()> {
        self.ssh.add_ssh_key_to_local_agent(self).await
    }
}
