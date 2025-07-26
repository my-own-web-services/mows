use crate::controller::crd::SecretReadableByFilezController;
use crate::http_api::health::HealthStatus;
use crate::{controller::crd::ValueOrSecretReference, storage::errors::StorageError};
use anyhow::Context;
use axum::body::Body;
use axum::extract::Request;
use bigdecimal::BigDecimal;
use futures_util::TryStreamExt;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::io::SeekFrom;
use std::path::PathBuf;
use tokio::fs::{self, File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio_util::io::ReaderStream;
use tracing::trace;
use utoipa::ToSchema;

use super::{FileVersionIdentifier, StorageProvider};

#[derive(Debug, Clone, Serialize, ToSchema, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct StorageProviderConfigFileSystem {
    pub root_path: String,
}

#[derive(Debug, Clone, Serialize, ToSchema, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageProviderConfigFileSystemCrd {
    pub root_path: ValueOrSecretReference,
}

impl StorageProviderConfigFileSystemCrd {
    pub fn convert_secrets(
        self,
        secret: SecretReadableByFilezController,
    ) -> Result<StorageProviderConfigFileSystem, StorageError> {
        Ok(StorageProviderConfigFileSystem {
            root_path: self.root_path.get_value(&secret)?,
        })
    }
}

#[derive(Debug, Clone)]
pub struct StorageProviderFilesystem {
    pub root_path: PathBuf,
    pub id: String,
}

impl StorageProviderFilesystem {
    pub async fn initialize(
        config: &StorageProviderConfigFileSystem,
        id: &str,
    ) -> Result<StorageProvider, StorageError> {
        let root_path = PathBuf::from(&config.root_path);
        fs::create_dir_all(&root_path)
            .await
            .context("Failed to create root directory for filesystem storage")?;
        Ok(StorageProvider::Filesystem(StorageProviderFilesystem {
            root_path,
            id: id.to_string(),
        }))
    }

    fn get_full_path(&self, file_identifier: &FileVersionIdentifier) -> PathBuf {
        // the file path is constructed like this:
        // - root_path
        // - last 3 characters of file_id as separate folders
        // - file_id
        // - version
        // - app_id
        // - app_path
        let file_id_string = file_identifier.file_id.to_string();
        let last_three_chars = file_id_string.chars().rev().collect::<Vec<_>>();

        let mut full_path = self
            .root_path
            .join(last_three_chars[0].to_string())
            .join(last_three_chars[1].to_string())
            .join(last_three_chars[2].to_string())
            .join(file_id_string)
            .join(file_identifier.version.to_string())
            .join(file_identifier.app_id.to_string());

        match &file_identifier.app_path.len() {
            0 => {
                full_path = full_path.join("data");
            }
            _ => {
                full_path = full_path.join("app_path").join(&file_identifier.app_path);
            }
        }

        trace!("Constructed full file path: {}", full_path.display());

        full_path
    }

    pub async fn get_content(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        _timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<Body, StorageError> {
        let path = self.get_full_path(full_file_identifier);
        let mut file = File::open(&path)
            .await
            .context("Failed to open file for reading")?;

        let (start, end) = match range {
            Some((start, end)) => (*start, *end),
            None => (None, None),
        };

        if let Some(start_pos) = start {
            file.seek(SeekFrom::Start(start_pos)).await?;
        }

        let stream = if let Some(end_pos) = end {
            let start_pos = start.unwrap_or(0);
            let length = end_pos - start_pos + 1;
            let reader = file.take(length);
            ReaderStream::new(reader)
        } else {
            let reader = file.take(u64::MAX);
            ReaderStream::new(reader)
        };

        Ok(Body::from_stream(stream))
    }

    pub async fn get_file_size(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        _timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, StorageError> {
        let path = self.get_full_path(full_file_identifier);
        let metadata = fs::metadata(path).await?;

        let file_size = metadata.len();
        Ok(BigDecimal::from(file_size))
    }

    pub async fn delete_content(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        _timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), StorageError> {
        let path = self.get_full_path(full_file_identifier);
        fs::remove_file(&path)
            .await
            .context("Failed to delete file")?;

        // Clean up empty parent directories
        let mut current_path = path.parent().unwrap().to_path_buf();
        while current_path != self.root_path {
            if fs::read_dir(&current_path)
                .await?
                .next_entry()
                .await?
                .is_none()
            {
                fs::remove_dir(&current_path).await?;
                current_path.pop();
            } else {
                break;
            }
        }

        Ok(())
    }

    pub async fn get_content_sha256_digest(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        _timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<String, StorageError> {
        let path = self.get_full_path(full_file_identifier);
        let mut file = File::open(&path)
            .await
            .context("Failed to open file for SHA256 digest calculation")?;

        let mut hasher = sha2::Sha256::new();
        let mut buffer = [0; 8192];
        while let Ok(bytes_read) = file.read(&mut buffer).await {
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        Ok(format!("{:x}", hasher.finalize()))
    }

    pub async fn set_content(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        _timing: &axum_server_timing::ServerTimingExtension,
        request: Request,
        _mime_type: &str,
        offset: u64,
        _length: u64,
    ) -> Result<(), StorageError> {
        let path = self.get_full_path(full_file_identifier);

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .open(&path)
            .await
            .context("Failed to open or create file for writing")?;

        file.seek(SeekFrom::Start(offset)).await?;

        let mut request_stream = request.into_body().into_data_stream();
        while let Some(chunk) = request_stream.try_next().await? {
            file.write_all(&chunk).await?;
        }

        Ok(())
    }

    pub async fn get_health(&self) -> HealthStatus {
        // Check if root_path exists and is writable
        let test_file_path = self.root_path.join(".health_check");
        match fs::write(&test_file_path, "health_check").await {
            Ok(_) => {
                let _ = fs::remove_file(&test_file_path).await;
                HealthStatus {
                    healthy: true,
                    response: "Healthy".to_string(),
                }
            }
            Err(e) => HealthStatus {
                healthy: false,
                response: e.to_string(),
            },
        }
    }
}
