use super::{config::StorageProviderConfig, providers::minio::StorageProviderMinio};
use crate::errors::FilezError;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct StorageLocationsState {
    pub locations: Arc<RwLock<HashMap<String, StorageProvider>>>,
    pub config: Arc<RwLock<HashMap<String, StorageProviderConfig>>>,
}

#[derive(Debug, Clone)]
pub enum StorageProvider {
    Minio(StorageProviderMinio),
}

impl StorageProvider {
    pub async fn initialize(
        provider_config: &StorageProviderConfig,
    ) -> Result<StorageProvider, FilezError> {
        match provider_config {
            StorageProviderConfig::Minio(config) => StorageProviderMinio::initialize(config).await,
        }
    }
}

impl StorageLocationsState {
    pub fn new() -> Self {
        Self {
            locations: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
