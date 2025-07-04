pub mod minio;
use bigdecimal::BigDecimal;

use super::{
    config::StorageProviderConfig, errors::StorageError, providers::minio::StorageProviderMinio,
};

#[derive(Debug, Clone)]
pub enum StorageProvider {
    Minio(StorageProviderMinio),
}

impl StorageProvider {
    pub async fn initialize(
        provider_config: &StorageProviderConfig,
        id: &str,
    ) -> Result<StorageProvider, StorageError> {
        match provider_config {
            StorageProviderConfig::Minio(config) => {
                StorageProviderMinio::initialize(config, id).await
            }
        }
    }
    pub async fn get_content(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<axum::body::Body, StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider.get_content(full_file_path, timing, range).await
            }
        }
    }

    pub async fn get_file_size(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider.get_file_size(full_file_path, timing).await
            }
        }
    }
}
