pub mod filesystem;
pub mod minio;
use axum::extract::Request;

use crate::{
    http_api::health::HealthStatus,
    models::file_versions::{ContentRange, FileVersionQuadIdentifier},
};

use super::{
    config::StorageProviderConfig,
    errors::StorageError,
    providers::{filesystem::StorageProviderFilesystem, minio::StorageProviderMinio},
};

#[derive(Debug, Clone)]
pub enum StorageProvider {
    Minio(StorageProviderMinio),
    Filesystem(StorageProviderFilesystem),
}

impl StorageProvider {
    #[tracing::instrument(level = "trace")]
    pub async fn get_health(&self) -> HealthStatus {
        match self {
            StorageProvider::Minio(provider) => provider.get_health().await,
            StorageProvider::Filesystem(provider) => provider.get_health().await,
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn initialize(
        provider_config: &StorageProviderConfig,
        id: &str,
    ) -> Result<StorageProvider, StorageError> {
        match provider_config {
            StorageProviderConfig::Minio(config) => {
                StorageProviderMinio::initialize(config, id).await
            }
            StorageProviderConfig::Filesystem(config) => {
                StorageProviderFilesystem::initialize(config, id).await
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_content(
        &self,
        full_file_identifier: &FileVersionQuadIdentifier,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<ContentRange>,
    ) -> Result<axum::body::Body, StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider
                    .get_content(full_file_identifier, timing, range)
                    .await
            }
            StorageProvider::Filesystem(provider) => {
                provider
                    .get_content(full_file_identifier, timing, range)
                    .await
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_file_size(
        &self,
        full_file_identifier: &FileVersionQuadIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<u64, StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider.get_file_size(full_file_identifier, timing).await
            }
            StorageProvider::Filesystem(provider) => {
                provider.get_file_size(full_file_identifier, timing).await
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_content_sha256_digest(
        &self,
        full_file_identifier: &FileVersionQuadIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<String, StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider
                    .get_content_sha256_digest(full_file_identifier, timing)
                    .await
            }
            StorageProvider::Filesystem(provider) => {
                provider
                    .get_content_sha256_digest(full_file_identifier, timing)
                    .await
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn set_content(
        &self,
        full_file_identifier: &FileVersionQuadIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
        request: Request,
        mime_type: &str,
        offset: u64,
        length: u64,
    ) -> Result<(), StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider
                    .set_content(
                        full_file_identifier,
                        timing,
                        request,
                        mime_type,
                        offset,
                        length,
                    )
                    .await
            }
            StorageProvider::Filesystem(provider) => {
                provider
                    .set_content(
                        full_file_identifier,
                        timing,
                        request,
                        mime_type,
                        offset,
                        length,
                    )
                    .await
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn delete_content(
        &self,
        full_file_identifier: &FileVersionQuadIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider.delete_content(full_file_identifier, timing).await
            }
            StorageProvider::Filesystem(provider) => {
                provider.delete_content(full_file_identifier, timing).await
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn truncate_content(
        &self,
        full_file_identifier: &FileVersionQuadIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
        new_content_size_bytes: u64,
    ) -> Result<(), StorageError> {
        match self {
            StorageProvider::Minio(provider) => {
                provider
                    .truncate_content(full_file_identifier, timing, new_content_size_bytes)
                    .await
            }
            StorageProvider::Filesystem(provider) => {
                provider
                    .truncate_content(full_file_identifier, timing, new_content_size_bytes)
                    .await
            }
        }
    }
}
