use anyhow::bail;

use crate::config::ClusterNode;

impl ClusterNode {
    pub async fn get_kubeconfig(&self) -> anyhow::Result<String> {
        let res = self.exec("sudo cat /etc/rancher/k3s/k3s.yaml", 2).await?;

        if res.is_empty() {
            bail!("Kubeconfig is empty")
        }

        if !res.contains("apiVersion") {
            bail!("Kubeconfig is invalid")
        }
        Ok(res)
    }

    pub async fn exec(&self, command: &str, timeout_seconds: u32) -> anyhow::Result<String> {
        self.ssh.exec(&self, command, timeout_seconds).await
    }
}
