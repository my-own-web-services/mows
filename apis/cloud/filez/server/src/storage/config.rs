use super::providers::minio::StorageProviderConfigMinio;
use diesel_as_jsonb::AsJsonb;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, AsJsonb)]
pub struct StorageConfig {
    pub storage_locations: HashMap<String, StorageProviderConfig>,
}

impl StorageConfig {
    pub fn default() -> Self {
        let mut storage_locations = HashMap::new();
        storage_locations.insert(
            "default".to_string(),
            StorageProviderConfig::Minio(StorageProviderConfigMinio {
                endpoint: "http://localhost:9000".to_string(),
                username: "minioadmin".to_string(),
                password: "minioadmin".to_string(),
                bucket: "filez".to_string(),
                id: "default".to_string(),
            }),
        );
        Self { storage_locations }
    }
}

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, JsonSchema)]
pub enum StorageProviderConfig {
    Minio(StorageProviderConfigMinio),
}
