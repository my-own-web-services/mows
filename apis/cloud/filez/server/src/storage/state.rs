use super::{
    config::StorageProviderConfig, errors::StorageError, providers::minio::StorageProviderMinio,
};
use crate::controller::crd::SecretReadableByFilezController;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct StorageLocationsState {
    pub locations: Arc<RwLock<HashMap<String, (StorageProvider, StorageProviderConfig)>>>,
}

#[derive(Debug, Clone)]
pub enum StorageProvider {
    Minio(StorageProviderMinio),
}

impl StorageProvider {
    pub async fn initialize(
        provider_config: &StorageProviderConfig,
        secret_map: &SecretReadableByFilezController,
        id: &str,
    ) -> Result<StorageProvider, StorageError> {
        match provider_config {
            StorageProviderConfig::Minio(config) => {
                StorageProviderMinio::initialize(config, secret_map, id).await
            }
        }
    }
}

impl StorageLocationsState {
    pub fn new() -> Self {
        Self {
            locations: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
