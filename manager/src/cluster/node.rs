use std::collections::BTreeMap;

use anyhow::bail;
use k8s_openapi::api::core::v1::Node;
use kube::{api::Patch, Api};
use serde_json::json;

use crate::{config::ClusterNode, s};

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

    /*
    Sets the labels that are required for longhorn to automatically detect the storage
    https://longhorn.io/docs/1.6.2/nodes-and-volumes/nodes/default-disk-and-node-config/
    */
    pub async fn set_storage_labels(&self, kc: &kube::Config) -> anyhow::Result<()> {
        let client = kube::client::Client::try_from(kc.clone())?;

        let nodes: Api<Node> = Api::all(client);

        // set the labels of the node
        let mut annotations = BTreeMap::new();

        annotations.insert(s!("node.longhorn.io/create-default-disk"), s!("'config'"));

        let disk_config = json!([
            {
                "path":"/mnt/disks/p0",
                "allowScheduling":true,
                "tags":[
                    "nvme"
                ]
            },
            {
                "path":"/mnt/disks/p1",
                "allowScheduling":true,
                "tags":[
                    "hdd"
                ]
            }
        ]);

        annotations.insert(s!("node.longhorn.io/default-disks-config"), s!("true"));
        annotations.insert(
            s!("node.longhorn.io/default-disks-config"),
            disk_config.to_string(),
        );

        let patch = json!({
            "metadata": {
                "annotations": annotations
            }
        });

        nodes
            .patch(
                &self.hostname,
                &kube::api::PatchParams::default(),
                &Patch::Merge(&patch),
            )
            .await?;

        Ok(())
    }
}
