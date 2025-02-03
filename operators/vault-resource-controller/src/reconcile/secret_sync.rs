use k8s_openapi::api::core::v1::{ConfigMap, Secret};
use kube::api::ObjectMeta;
use mows_common::templating::{
    functions::{serde_json_value_to_gtmpl_value, TEMPLATE_FUNCTIONS},
    gtmpl::{self, Context as GtmplContext, Template, Value as GtmplValue},
    gtmpl_derive::Gtmpl,
};

use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
};
use tracing::debug;
use vaultrs::client::VaultClient;

use crate::{crd::VaultSecretSync, FINALIZER};

#[derive(Gtmpl)]
struct LocalContext {
    secrets: HashMap<String, GtmplValue>,
}

const MANAGED_BY_KEY: &str = "app.kubernetes.io/managed-by";

#[derive(Debug)]
struct RenderedSecret {
    secret_type: Option<String>,
    map: BTreeMap<String, String>,
}

pub async fn handle_secret_sync(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    target_namespace: &str,
    vault_secret_sync: &VaultSecretSync,
    kube_client: &kube::Client,
) -> Result<(), crate::ControllerError> {
    let mut fetched_secrets: HashMap<String, GtmplValue> = HashMap::new();

    for (template_key, fetch_from) in vault_secret_sync.kv_mapping.iter() {
        let vault_engine_path = Path::new("mows-core-secrets-vrc")
            .join(resource_namespace)
            .join(&fetch_from.engine);
        let vault_engine_path = vault_engine_path
            .to_str()
            .ok_or(crate::ControllerError::GenericError(
                "Failed to create engine path".to_string(),
            ))?;

        debug!("Fetching secrets from: {:?}", &vault_engine_path);

        let secret: serde_json::Value =
            vaultrs::kv2::read(vault_client, &vault_engine_path, &fetch_from.path).await?;
        fetched_secrets.insert(template_key.clone(), serde_json_value_to_gtmpl_value(secret));
    }

    debug!("Fetched secrets: {:?}", fetched_secrets);

    let mut rendered_secrets: HashMap<String, RenderedSecret> = HashMap::new();

    let mut rendered_configmaps: HashMap<String, BTreeMap<String, String>> = HashMap::new();

    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        secrets: fetched_secrets.clone(),
    });

    if let Some(target_secrets) = &vault_secret_sync.targets.secrets {
        for (target_secret_name, target_secret) in target_secrets.iter() {
            let mut rendered_secret = BTreeMap::new();

            for (map_name, target) in target_secret.map.iter() {
                template_creator.parse(target.clone().replace("{%", "{{").replace("%}", "}}"))?;
                rendered_secret.insert(map_name.clone(), template_creator.render(&context)?);
            }

            rendered_secrets.insert(
                target_secret_name.clone(),
                RenderedSecret {
                    secret_type: target_secret.secret_type.clone(),
                    map: rendered_secret,
                },
            );
        }

        debug!("Rendered secrets: {:?}", rendered_secrets);
    }

    if let Some(target_configmaps) = &vault_secret_sync.targets.config_maps {
        for (target_configmap_name, target_configmap) in target_configmaps.iter() {
            let mut rendered_configmap = BTreeMap::new();

            for (map_name, target) in target_configmap.iter() {
                template_creator.parse(target.clone().replace("{%", "{{").replace("%}", "}}"))?;
                rendered_configmap.insert(map_name.clone(), template_creator.render(&context)?);
            }

            rendered_configmaps.insert(target_configmap_name.clone(), rendered_configmap);
        }
    }

    let mut labels = BTreeMap::new();

    labels.insert(MANAGED_BY_KEY.to_string(), FINALIZER.to_string());

    labels.insert(
        "created-from".to_string(),
        format!("{}.{}", resource_name, resource_namespace),
    );

    for (secret_name, rendered_secret) in rendered_secrets {
        create_secret_in_k8s(
            kube_client,
            &target_namespace,
            secret_name,
            rendered_secret.map,
            labels.clone(),
            rendered_secret.secret_type,
        )
        .await?;
    }

    for (configmap_name, configmap_data) in rendered_configmaps {
        create_configmap_in_k8s(
            kube_client,
            &target_namespace,
            configmap_name,
            configmap_data,
            labels.clone(),
        )
        .await?;
    }

    Ok(())
}

pub async fn create_configmap_in_k8s(
    kube_client: &kube::Client,
    resource_namespace: &str,
    configmap_name: String,
    configmap_data: BTreeMap<String, String>,
    labels: BTreeMap<String, String>,
) -> Result<(), crate::ControllerError> {
    let configmap_api: kube::Api<ConfigMap> = kube::Api::namespaced(kube_client.clone(), resource_namespace);

    let mut new_configmap = ConfigMap {
        metadata: ObjectMeta {
            name: Some(configmap_name.clone()),
            namespace: Some(resource_namespace.to_string()),
            labels: Some(labels.clone()),

            ..Default::default()
        },
        data: Some(configmap_data),
        ..Default::default()
    };

    let configmap_exists = configmap_api
        .get_opt(&configmap_name)
        .await
        .map_err(crate::ControllerError::KubeError)?;

    if let Some(old_configmap) = &configmap_exists {
        if let Some(labels) = &old_configmap.metadata.labels {
            if let Some(managed_by) = labels.get(MANAGED_BY_KEY) {
                if managed_by != FINALIZER {
                    return Err(crate::ControllerError::GenericError(format!(
                        "ConfigMap {} is not managed by vrc",
                        configmap_name
                    )));
                }
            } else {
                return Err(crate::ControllerError::GenericError(format!(
                    "ConfigMap {} is not managed by vrc",
                    configmap_name
                )));
            }
        }
        let patch_params = kube::api::PostParams::default();

        new_configmap.metadata.resource_version = old_configmap.metadata.resource_version.clone();

        configmap_api
            .replace(&configmap_name, &patch_params, &new_configmap)
            .await
            .map_err(crate::ControllerError::KubeError)?;
    } else {
        configmap_api
            .create(&kube::api::PostParams::default(), &new_configmap)
            .await
            .map_err(crate::ControllerError::KubeError)?;
    }

    Ok(())
}

pub async fn create_secret_in_k8s(
    kube_client: &kube::Client,
    resource_namespace: &str,
    secret_name: String,
    secret_map: BTreeMap<String, String>,
    labels: BTreeMap<String, String>,
    secret_type: Option<String>,
) -> Result<(), crate::ControllerError> {
    let secret_api: kube::Api<Secret> = kube::Api::namespaced(kube_client.clone(), resource_namespace);

    let mut new_secret = Secret {
        metadata: ObjectMeta {
            name: Some(secret_name.clone()),
            namespace: Some(resource_namespace.to_string()),
            labels: Some(labels.clone()),

            ..Default::default()
        },
        type_: secret_type,
        string_data: Some(secret_map),
        ..Default::default()
    };

    let secret_exists = secret_api
        .get_opt(&secret_name)
        .await
        .map_err(crate::ControllerError::KubeError)?;

    if let Some(old_secret) = &secret_exists {
        if let Some(labels) = &old_secret.metadata.labels {
            if let Some(managed_by) = labels.get(MANAGED_BY_KEY) {
                if managed_by != FINALIZER {
                    return Err(crate::ControllerError::GenericError(format!(
                        "Secret {} is not managed by vrc",
                        secret_name
                    )));
                }
            } else {
                return Err(crate::ControllerError::GenericError(format!(
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
            .map_err(crate::ControllerError::KubeError)?;
    } else {
        secret_api
            .create(&kube::api::PostParams::default(), &new_secret)
            .await
            .map_err(crate::ControllerError::KubeError)?;
    }

    Ok(())
}
