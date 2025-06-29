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

impl StorageConfig {}

#[derive(Serialize, Deserialize, Debug, ToSchema, Clone, JsonSchema, PartialEq, Eq)]
pub enum StorageProviderConfig {
    Minio(StorageProviderConfigMinio),
}
