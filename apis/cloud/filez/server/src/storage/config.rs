use crate::{kubernetes_controller::crd::SecretReadableByFilezController, errors::FilezError};

use super::providers::{
    filesystem::{StorageProviderConfigFileSystem, StorageProviderConfigFileSystemCrd},
    minio::{StorageProviderConfigMinio, StorageProviderConfigMinioCrd},
};
use diesel_as_jsonb::AsJsonb;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, JsonSchema, PartialEq, Eq, AsJsonb)]
pub enum StorageProviderConfig {
    Minio(StorageProviderConfigMinio),
    Filesystem(StorageProviderConfigFileSystem),
}

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, JsonSchema, PartialEq, Eq)]
pub enum StorageProviderConfigCrd {
    Minio(StorageProviderConfigMinioCrd),
    Filesystem(StorageProviderConfigFileSystemCrd),
}

impl StorageProviderConfigCrd {
    #[tracing::instrument(level = "trace")]
    pub fn convert_secrets(
        &self,
        secrets: SecretReadableByFilezController,
    ) -> Result<StorageProviderConfig, FilezError> {
        let provider_config = match self {
            StorageProviderConfigCrd::Minio(config) => {
                StorageProviderConfig::Minio(config.clone().convert_secrets(secrets)?)
            }
            StorageProviderConfigCrd::Filesystem(config) => {
                StorageProviderConfig::Filesystem(config.clone().convert_secrets(secrets)?)
            }
        };

        Ok(provider_config)
    }
}
