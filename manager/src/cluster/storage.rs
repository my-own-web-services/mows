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

use tracing::debug;

use crate::{
    config::{Cluster, ClusterNode},
    utils::generate_id,
};
use mows_common_rust::s;

pub struct ClusterStorage;

const LONGHORN_STORAGE_CLASS_NAME: &str = "mows-core-storage-longhorn-static";

impl ClusterStorage {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        ClusterStorage::install_longhorn().await?;
        ClusterStorage::create_storage_class(cluster).await?;
        ClusterStorage::configure_node_storage_labels(cluster).await?;

        Ok(())
    }

    async fn configure_node_storage_labels(cluster: &Cluster) -> anyhow::Result<()> {
        for (_, node) in &cluster.cluster_nodes {
            ClusterStorage::set_storage_labels(&node, &cluster).await?;
        }

        Ok(())
    }

    async fn create_storage_secrets(
        client: &Client,
        secret_name: &str,
        namespace: &str,
    ) -> anyhow::Result<()> {
        debug!("Creating storage secrets");

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

        let res = match secret_api
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
        };

        debug!("Storage secrets created");

        res
    }

    async fn check_storage_class_exists_and_has_params(
        cluster: &Cluster,
        sc_name: &str,
        params: &BTreeMap<String, String>,
    ) -> anyhow::Result<bool> {
        let client = cluster.get_kube_client().await?;

        let sc_api: kube::Api<StorageClass> = kube::Api::all(client.clone());

        let sc = match sc_api.get(sc_name).await {
            Ok(sc) => sc,
            Err(e) => {
                if e.to_string().contains("not found") {
                    return Ok(false);
                } else {
                    bail!(e);
                }
            }
        };

        let sc_params = sc.parameters.unwrap();

        for (k, v) in params {
            if sc_params.get(k).unwrap() != v {
                return Ok(false);
            }
        }

        Ok(true)
    }

    async fn create_storage_class(cluster: &Cluster) -> anyhow::Result<()> {
        debug!("Creating storage class");

        let mut params_map = BTreeMap::new();

        let secret_name = "mows-core-storage-longhorn-secret";
        let namespace = "mows-core-storage-longhorn";

        let client = cluster.get_kube_client().await?;

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
            params_map.insert(param.0.to_string(), param.1.to_string());
        }

        let mut annotations = BTreeMap::new();

        annotations.insert(
            s!("storageclass.kubernetes.io/is-default-class"),
            s!("true"),
        );

        let sc = StorageClass {
            metadata: ObjectMeta {
                name: Some(s!(LONGHORN_STORAGE_CLASS_NAME)),
                annotations: Some(annotations),
                ..ObjectMeta::default()
            },
            provisioner: s!("driver.longhorn.io"),
            allow_volume_expansion: Some(true),
            reclaim_policy: Some(s!("Delete")),
            volume_binding_mode: Some(s!("Immediate")),
            parameters: Some(params_map.clone()),
            ..StorageClass::default()
        };

        //dbg!(sc.clone());

        let sc_api: kube::Api<StorageClass> = kube::Api::all(client);

        // delete it if it already exists

        let _ = sc_api
            .delete(
                &s!(LONGHORN_STORAGE_CLASS_NAME),
                &kube::api::DeleteParams::default(),
            )
            .await;

        let res = match sc_api.create(&kube::api::PostParams::default(), &sc).await {
            Ok(_) => Ok(()),
            Err(e) => {
                if e.to_string().contains("already exists") {
                    Ok(())
                } else {
                    bail!(e);
                }
            }
        };

        // check if storage class was correctly created
        ClusterStorage::check_storage_class_exists_and_has_params(
            cluster,
            LONGHORN_STORAGE_CLASS_NAME,
            &params_map,
        )
        .await?;

        debug!("Storage class created");

        res
    }

    pub async fn install_longhorn() -> anyhow::Result<()> {
        debug!("Installing longhorn storage");

        Cluster::install_with_kustomize("/install/core/storage/longhorn/").await?;

        debug!("Longhorn storage installed");

        Ok(())
    }

    /*
    Sets the labels that are required for longhorn to automatically detect the storage
    https://longhorn.io/docs/1.6.2/nodes-and-volumes/nodes/default-disk-and-node-config/
    */
    pub async fn set_storage_labels(node: &ClusterNode, cluster: &Cluster) -> anyhow::Result<()> {
        let client = cluster.get_kube_client().await?;

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
                &node.machine_id,
                &kube::api::PatchParams::default(),
                &Patch::Merge(&patch),
            )
            .await?;

        Ok(())
    }
}
