use std::collections::BTreeMap;

use anyhow::bail;
use k8s_openapi::api::{
    core::v1::{Node, Secret},
    storage::v1::StorageClass,
};
use kube::{
    api::{ObjectMeta, Patch},
    Api, Client,
};
use serde_json::json;

use crate::{
    config::{Cluster, ClusterNode, HelmDeploymentState},
    s,
    utils::{cmd, generate_id},
};

pub struct ClusterStorage;

impl ClusterStorage {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        ClusterStorage::install_longhorn().await?;
        ClusterStorage::create_storage_class(cluster).await?;
        ClusterStorage::configure_node_storage_labels(cluster).await?;

        Ok(())
    }

    pub async fn configure_node_storage_labels(cluster: &Cluster) -> anyhow::Result<()> {
        let kc = cluster.get_kubeconfig_struct().await?;

        for (_, node) in &cluster.cluster_nodes {
            ClusterStorage::set_storage_labels(&node, &kc).await?;
        }

        Ok(())
    }

    pub async fn create_storage_secrets(
        client: &Client,
        secret_name: &str,
        namespace: &str,
    ) -> anyhow::Result<()> {
        let mut string_data = BTreeMap::new();

        let password = generate_id(100);

        let sd = [
            ("CRYPTO_KEY_VALUE", password.as_str()),
            ("CRYPTO_KEY_PROVIDER", "secret"),
            ("CRYPTO_KEY_CIPHER", "aes-xts-plain64"),
            ("CRYPTO_KEY_HASH", "sha256"),
            ("CRYPTO_KEY_SIZE", "256"),
            ("CRYPTO_PBKDF", "argon2i"),
        ];

        for s in sd {
            string_data.insert(s.0.to_string(), s.1.to_string());
        }

        let secret = Secret {
            metadata: ObjectMeta {
                name: Some(s!(secret_name)),
                namespace: Some(s!(namespace)),
                ..ObjectMeta::default()
            },
            string_data: Some(string_data),
            ..Default::default()
        };

        let secret_api: kube::Api<Secret> = kube::Api::namespaced(client.clone(), namespace);

        match secret_api
            .create(&kube::api::PostParams::default(), &secret)
            .await
        {
            Ok(_) => Ok(()),
            Err(e) => {
                if e.to_string().contains("already exists") {
                    Ok(())
                } else {
                    bail!(e);
                }
            }
        }
    }

    pub async fn create_storage_class(cluster: &Cluster) -> anyhow::Result<()> {
        let params_map = BTreeMap::new();

        let secret_name = "mows-storage-secret";
        let namespace = "mows-storage";

        let kc = cluster.get_kubeconfig_struct().await?;

        let client = kube::client::Client::try_from(kc.clone())?;

        ClusterStorage::create_storage_secrets(&client, &secret_name, &namespace).await?;

        let params = [
            ("numberOfReplicas", "2"),
            ("encrypted", "true"),
            ("dataLocality", "best-effort"),
            ("csi.storage.k8s.io/provisioner-secret-name", secret_name),
            ("csi.storage.k8s.io/provisioner-secret-namespace", namespace),
            ("csi.storage.k8s.io/node-publish-secret-name", secret_name),
            (
                "csi.storage.k8s.io/node-publish-secret-namespace",
                namespace,
            ),
            ("csi.storage.k8s.io/node-stage-secret-name", secret_name),
            ("csi.storage.k8s.io/node-stage-secret-namespace", namespace),
        ];

        for param in params {
            let mut params_map = BTreeMap::new();
            params_map.insert(param.0.to_string(), param.1.to_string());
        }

        let sc = StorageClass {
            metadata: ObjectMeta {
                name: Some(s!("longhorn-static")),
                ..ObjectMeta::default()
            },
            provisioner: s!("driver.longhorn.io"),
            allow_volume_expansion: Some(true),
            reclaim_policy: Some(s!("Delete")),
            volume_binding_mode: Some(s!("Immediate")),
            parameters: Some(params_map),
            ..StorageClass::default()
        };

        let sc_api: kube::Api<StorageClass> = kube::Api::all(client);

        match sc_api.create(&kube::api::PostParams::default(), &sc).await {
            Ok(_) => Ok(()),
            Err(e) => {
                if e.to_string().contains("already exists") {
                    Ok(())
                } else {
                    bail!(e);
                }
            }
        }
    }

    pub async fn install_longhorn() -> anyhow::Result<()> {
        if Cluster::check_helm_deployment_state("mows-storage", "mows-storage").await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(()); // network is already installed
        }
        let longhorn_version = "1.6.2";
        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "longhorn",
                "https://charts.longhorn.io",
            ],
            "Failed to add storage/longhorn helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                "mows-storage",
                // chart
                "longhorn/longhorn",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                "mows-storage",
                //
                "--version",
                longhorn_version,
                //
                "--set",
                "defaultSettings.createDefaultDiskLabeledNodes=true",
                //
                "--set",
                "defaultSettings.allowCollectingLonghornUsageMetrics=false",
            ],
            "Failed to install storage/longhorn",
        )
        .await?;

        Ok(())
    }

    /*
    Sets the labels that are required for longhorn to automatically detect the storage
    https://longhorn.io/docs/1.6.2/nodes-and-volumes/nodes/default-disk-and-node-config/
    */
    pub async fn set_storage_labels(node: &ClusterNode, kc: &kube::Config) -> anyhow::Result<()> {
        let client = kube::client::Client::try_from(kc.clone())?;

        let nodes: Api<Node> = Api::all(client);

        // set the labels of the node
        let mut annotations = BTreeMap::new();
        let mut labels = BTreeMap::new();

        labels.insert(s!("node.longhorn.io/create-default-disk"), s!("config"));

        let disk_config = json!([
            {
                "path":"/var/lib/longhorn/drives/p0",
                "allowScheduling":true,
                "tags":[
                    "nvme"
                ]
            },
            {
                "path":"/var/lib/longhorn/drives/p1",
                "allowScheduling":true,
                "tags":[
                    "hdd"
                ]
            }
        ]);

        annotations.insert(
            s!("node.longhorn.io/default-disks-config"),
            disk_config.to_string(),
        );

        let patch = json!({
            "metadata": {
                "annotations": annotations,
                "labels": labels
            }
        });

        nodes
            .patch(
                &node.hostname,
                &kube::api::PatchParams::default(),
                &Patch::Merge(&patch),
            )
            .await?;

        Ok(())
    }
}
