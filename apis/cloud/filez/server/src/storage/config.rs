use crate::{
    controller::crd::SecretReadableByFilezController,
    models::storage_locations::errors::StorageLocationError,
};

use super::providers::minio::{StorageProviderConfigMinio, StorageProviderConfigMinioCrd};
use diesel_as_jsonb::AsJsonb;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, JsonSchema, PartialEq, Eq, AsJsonb)]
pub enum StorageProviderConfig {
    Minio(StorageProviderConfigMinio),
}

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, JsonSchema, PartialEq, Eq)]
pub enum StorageProviderConfigCrd {
    Minio(StorageProviderConfigMinioCrd),
}

impl StorageProviderConfigCrd {
    pub fn convert_secrets(
        &self,
        secrets: SecretReadableByFilezController,
    ) -> Result<StorageProviderConfig, StorageLocationError> {
        let provider_config = match self {
            StorageProviderConfigCrd::Minio(config) => {
                StorageProviderConfig::Minio(config.clone().convert_secrets(secrets)?)
            }
        };

        Ok(provider_config)
    }
}
