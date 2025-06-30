use super::errors::ControllerError;
use crate::{
    apps::FilezApp,
    storage::{config::StorageProviderConfig, errors::StorageError},
};
use k8s_openapi::api::core::v1::Secret;
use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "FilezResource",
    group = "filez.k8s.mows.cloud",
    version = "v1",
    namespaced,
    doc = "Custom kubernetes resource for applying Filez resources such as storage locations and filez apps."
)]
#[kube(status = "FilezResourceStatus", shortname = "fr")]
#[serde(rename_all = "camelCase")]
pub enum FilezResourceSpec {
    StorageLocation(StorageProviderConfig),
    FilezApp(FilezApp),
}

#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct FilezResourceStatus {
    pub created: bool,
}

/// We have a cluster role that allows the filez controller to read all secrets in the cluster that are named with this identifier.
pub const FILEZ_CLUSTER_ROLE_SECRET_IDENTIFIER: &str = "SecretReadableByFilezController";

pub struct SecretReadableByFilezController {
    pub secrets: HashMap<String, String>,
}

impl SecretReadableByFilezController {
    pub async fn fetch_map(
        kube_client: &kube::Client,
        namespace: &str,
    ) -> Result<SecretReadableByFilezController, ControllerError> {
        let secrets_api: kube::api::Api<Secret> =
            kube::api::Api::namespaced(kube_client.clone(), namespace);

        let secret = secrets_api
            .get(FILEZ_CLUSTER_ROLE_SECRET_IDENTIFIER)
            .await?;

        let mut secret_map = HashMap::new();

        if let Some(data) = secret.data {
            for (key, value) in data {
                if let Some(value_str) = String::from_utf8(value.0.to_vec()).ok() {
                    secret_map.insert(key, value_str);
                }
            }
        }

        Ok(SecretReadableByFilezController {
            secrets: secret_map,
        })
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.secrets.get(key)
    }
}

/// When a secret is referenced, it references the data field of the kubernetes secret in the same namespace as the filez resource with the name SecretReadableByFilezController.
#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum ValueOrSecretReference {
    Value(String),
    Secret(String),
}

impl ValueOrSecretReference {
    pub fn get_value(
        &self,
        secret_map: &SecretReadableByFilezController,
    ) -> Result<String, StorageError> {
        match self {
            ValueOrSecretReference::Value(value) => Ok(value.clone()),
            ValueOrSecretReference::Secret(filez_secrets) => secret_map
                .get(filez_secrets)
                .cloned()
                .ok_or_else(|| StorageError::SecretNotFound(filez_secrets.clone())),
        }
    }
}
