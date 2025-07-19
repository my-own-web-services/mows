pub mod minio;
use axum::extract::Request;
use bigdecimal::BigDecimal;

use crate::api::health::HealthStatus;

use super::{
    config::StorageProviderConfig, errors::StorageError, providers::minio::StorageProviderMinio,
};

#[derive(Debug, Clone)]
pub enum StorageProvider {
    Minio(StorageProviderMinio),
}

impl StorageProvider {
    pub async fn get_health(&self) -> HealthStatus {
        match self {
            StorageProvider::Minio(provider) => provider.get_health().await,
        }
    }

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
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider.get_file_size(full_file_path, timing).await
            }
        }
    }

    pub async fn update_content(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        request: Request,
        mime_type: &str,
        offset: u64,
        length: u64,
    ) -> Result<(), StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider
                    .update_content(full_file_path, timing, request, mime_type, offset, length)
                    .await
            }
        }
    }

    pub async fn delete_content(
        &self,
        full_file_path: &str,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider.delete_content(full_file_path, timing).await
            }
        }
    }
}
