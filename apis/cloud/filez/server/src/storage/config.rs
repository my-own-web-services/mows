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
