use crate::{
    config::{ClusterNode, Config},
    some_or_bail,
};

impl ClusterNode {
    pub async fn get_kubeconfig(&self, config: &Config) -> anyhow::Result<String> {
        let machine = some_or_bail!(
            config.get_machine_by_name(&self.machine_id),
            "Machine not found"
        );

        let res = self
            .ssh_access
            .exec(&machine, "sudo cat /etc/rancher/k3s/k3s.yaml", 5)
            .await?;

        Ok(res)
    }
}
