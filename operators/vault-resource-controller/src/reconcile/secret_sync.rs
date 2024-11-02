use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
};

use gtmpl_derive::Gtmpl;
use k8s_openapi::api::core::v1::{ConfigMap, Secret};
use kube::api::{ObjectMeta, Patch};
use tracing::debug;
use vaultrs::client::VaultClient;

use crate::{SecretSyncTargetResource, VaultSecretSync, VAULT_RESOURCES_FINALIZER};

#[derive(Gtmpl)]
struct Context {
    secrets: HashMap<String, HashMap<String, String>>,
}

const MANAGED_BY_KEY: &str = "mows.cloud/managed-by";

pub async fn handle_secret_sync(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_secret_sync: &VaultSecretSync,
    kube_client: &kube::Client,
) -> Result<(), crate::Error> {
    let mut fetched_secrets: HashMap<String, HashMap<String, String>> = HashMap::new();

    for (template_key, fetch_from) in vault_secret_sync.kv_mapping.iter() {
        let vault_engine_path = Path::new("mows-core-secrets-vrc")
            .join(resource_namespace)
            .join(&fetch_from.engine);
        let vault_engine_path = vault_engine_path.to_str().ok_or(crate::Error::GenericError(
            "Failed to create engine path".to_string(),
        ))?;

        debug!("Fetching secrets from: {:?}", &vault_engine_path);

        let secret: HashMap<String, String> =
            vaultrs::kv2::read(vault_client, &vault_engine_path, &fetch_from.path).await?;
        fetched_secrets.insert(template_key.clone(), secret);
    }

    debug!("Fetched secrets: {:?}", fetched_secrets);

    let mut rendered_secrets: HashMap<String, String> = HashMap::new();

    let mut template_creator = gtmpl::Template::default();
    template_creator.add_funcs(&crate::templating::functions::TEMPLATE_FUNCTIONS);

    let context = gtmpl::Context::from(Context {
        secrets: fetched_secrets.clone(),
    });

    for (target_name, target) in vault_secret_sync.targets.iter() {
        template_creator.parse(target.template.clone().replace("{%", "{{").replace("%}", "}}"))?;
        rendered_secrets.insert(target_name.clone(), template_creator.render(&context)?);
    }

    debug!("Rendered secrets: {:?}", rendered_secrets);

    let mut labels = BTreeMap::new();

    labels.insert(MANAGED_BY_KEY.to_string(), VAULT_RESOURCES_FINALIZER.to_string());

    labels.insert("created-from".to_string(), resource_name.to_string());

    for (secret_name, secret_data) in rendered_secrets {
        let target = vault_secret_sync
            .targets
            .get(&secret_name)
            .ok_or(crate::Error::GenericError(format!(
                "Secret {} not found in targets",
                secret_name
            )))?
            .clone();

        match target.resource_type {
            SecretSyncTargetResource::ConfigMap => {
                create_configmap_in_k8s(
                    kube_client,
                    resource_namespace,
                    secret_name,
                    secret_data,
                    labels.clone(),
                    target.resource_map_key,
                )
                .await?
            }
            SecretSyncTargetResource::Secret => {
                create_secret_in_k8s(
                    kube_client,
                    resource_namespace,
                    secret_name,
                    secret_data,
                    labels.clone(),
                    target.resource_map_key,
                )
                .await?
            }
        }
    }

    Ok(())
}

pub async fn create_configmap_in_k8s(
    kube_client: &kube::Client,
    resource_namespace: &str,
    secret_name: String,
    secret_data: String,
    labels: BTreeMap<String, String>,
    resource_data_key: Option<String>,
) -> Result<(), crate::Error> {
    let configmap_api: kube::Api<ConfigMap> = kube::Api::namespaced(kube_client.clone(), resource_namespace);

    let mut configmap_data = BTreeMap::new();

    configmap_data.insert(resource_data_key.unwrap_or("data".to_string()), secret_data);

    let mut new_configmap = ConfigMap {
        metadata: ObjectMeta {
            name: Some(secret_name.clone()),
            namespace: Some(resource_namespace.to_string()),
            labels: Some(labels.clone()),

            ..Default::default()
        },
        data: Some(configmap_data),
        ..Default::default()
    };

    let configmap_exists = configmap_api
        .get_opt(&secret_name)
        .await
        .map_err(crate::Error::KubeError)?;

    if let Some(old_configmap) = &configmap_exists {
        if let Some(labels) = &old_configmap.metadata.labels {
            if let Some(managed_by) = labels.get(MANAGED_BY_KEY) {
                if managed_by != VAULT_RESOURCES_FINALIZER {
                    return Err(crate::Error::GenericError(format!(
                        "ConfigMap {} is not managed by vrc",
                        secret_name
                    )));
                }
            } else {
                return Err(crate::Error::GenericError(format!(
                    "ConfigMap {} is not managed by vrc",
                    secret_name
                )));
            }
        }
        let patch_params = kube::api::PostParams::default();

        new_configmap.metadata.resource_version = old_configmap.metadata.resource_version.clone();

        configmap_api
            .replace(&secret_name, &patch_params, &new_configmap)
            .await
            .map_err(crate::Error::KubeError)?;
    } else {
        configmap_api
            .create(&kube::api::PostParams::default(), &new_configmap)
            .await
            .map_err(crate::Error::KubeError)?;
    }

    Ok(())
}

pub async fn create_secret_in_k8s(
    kube_client: &kube::Client,
    resource_namespace: &str,
    secret_name: String,
    secret_data: String,
    labels: BTreeMap<String, String>,
    resource_data_key: Option<String>,
) -> Result<(), crate::Error> {
    let secret_api: kube::Api<Secret> = kube::Api::namespaced(kube_client.clone(), resource_namespace);

    let mut secret_map = BTreeMap::new();

    secret_map.insert(resource_data_key.unwrap_or("data".to_string()), secret_data);

    let mut new_secret = Secret {
        metadata: ObjectMeta {
            name: Some(secret_name.clone()),
            namespace: Some(resource_namespace.to_string()),
            labels: Some(labels.clone()),

            ..Default::default()
        },
        string_data: Some(secret_map),
        ..Default::default()
    };

    let secret_exists = secret_api
        .get_opt(&secret_name)
        .await
        .map_err(crate::Error::KubeError)?;

    if let Some(old_secret) = &secret_exists {
        if let Some(labels) = &old_secret.metadata.labels {
            if let Some(managed_by) = labels.get(MANAGED_BY_KEY) {
                if managed_by != VAULT_RESOURCES_FINALIZER {
                    return Err(crate::Error::GenericError(format!(
                        "Secret {} is not managed by vrc",
                        secret_name
                    )));
                }
            } else {
                return Err(crate::Error::GenericError(format!(
                    "Secret {} is not managed by vrc",
                    secret_name
                )));
            }
        }
        let patch_params = kube::api::PostParams::default();

        new_secret.metadata.resource_version = old_secret.metadata.resource_version.clone();
        secret_api
            .replace(&secret_name, &patch_params, &new_secret)
            .await
            .map_err(crate::Error::KubeError)?;
    } else {
        secret_api
            .create(&kube::api::PostParams::default(), &new_secret)
            .await
            .map_err(crate::Error::KubeError)?;
    }

    Ok(())
}
