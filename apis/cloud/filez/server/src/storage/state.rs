use super::{config::StorageProviderConfig, providers::minio::StorageProviderMinio};
use crate::{config::config, errors::FilezError};
use mows_common_rust::get_current_config_cloned;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct StorageLocationsState {
    pub providers: Arc<RwLock<HashMap<Uuid, StorageProvider>>>,
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
    pub async fn new() -> Result<Self, FilezError> {
        let config = get_current_config_cloned!(config());

        let mut providers = HashMap::new();

        for (provider_name, provider_config) in &config.storage.storage_locations {
            providers.insert(
                provider_name.clone(),
                StorageProvider::initialize(provider_config).await?,
            );
        }

        // Wrap the providers in an Arc<Mutex> for thread-safe access
        let providers = Arc::new(RwLock::new(providers));

        Ok(Self { providers })
    }
}
