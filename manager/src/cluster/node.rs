use anyhow::bail;

use crate::{
    config::{ClusterNode, Machine},
    get_current_config_cloned,
};

impl ClusterNode {
    pub async fn get_kubeconfig(&self) -> anyhow::Result<String> {
        let machine = self.get_machine().await?;
        let res = machine
            .exec("sudo cat /etc/rancher/k3s/k3s.yaml", 2)
            .await?;

        if res.is_empty() {
            bail!("Kubeconfig is empty")
        }

        if !res.contains("apiVersion") {
            bail!("Kubeconfig is invalid")
        }
        Ok(res)
    }
    pub async fn get_machine(&self) -> anyhow::Result<Machine> {
        let cfg = get_current_config_cloned!();
        let machine = cfg.get_machine_by_id(&self.machine_id).unwrap();
        Ok(machine)
    }
}
