use crate::controller::crd::SecretReadableByFilezController;
use crate::http_api::health::HealthStatus;
use crate::models::file_versions::ContentRange;
use crate::storage::errors::InnerStorageError;
use crate::{controller::crd::ValueOrSecretReference, storage::errors::StorageError, with_timing};
use anyhow::Context;
use axum::body::Body;
use axum::extract::Request;
use futures::StreamExt;
use futures_util::TryStreamExt;
use minio::s3::{builders::ObjectContent, types::S3Api};
use minio::s3::{creds::StaticProvider, http::BaseUrl, ClientBuilder};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::str::FromStr;
use utoipa::ToSchema;

use super::{FileVersionIdentifier, StorageProvider};

#[derive(Debug, Clone, Serialize, ToSchema, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct StorageProviderConfigMinio {
    pub endpoint: String,
    pub username: String,
    pub password: String,
    pub bucket: String,
}

#[derive(Debug, Clone, Serialize, ToSchema, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageProviderConfigMinioCrd {
    pub endpoint: ValueOrSecretReference,
    pub username: ValueOrSecretReference,
    pub password: ValueOrSecretReference,
    pub bucket: ValueOrSecretReference,
}

impl StorageProviderConfigMinioCrd {
    #[tracing::instrument(level = "trace")]
    pub fn convert_secrets(
        self,
        secret: SecretReadableByFilezController,
    ) -> Result<StorageProviderConfigMinio, StorageError> {
        Ok(StorageProviderConfigMinio {
            endpoint: self.endpoint.get_value(&secret)?,
            username: self.username.get_value(&secret)?,
            password: self.password.get_value(&secret)?,
            bucket: self.bucket.get_value(&secret)?,
        })
    }
}

#[derive(Debug, Clone)]
pub struct StorageProviderMinio {
    pub client: minio::s3::Client,
    pub bucket: String,
    pub id: String,
}

impl StorageProviderMinio {
    #[tracing::instrument(level = "trace")]
    pub async fn initialize(
        config: &StorageProviderConfigMinio,
        id: &str,
    ) -> Result<StorageProvider, StorageError> {
        let static_provider = StaticProvider::new(&config.username, &config.password, None);
        let client = ClientBuilder::new(
            BaseUrl::from_str(&config.endpoint).context("Failed to parse MinIO endpoint URL.")?,
        )
        .provider(Some(Box::new(static_provider)))
        .build()
        .context("Failed to create MinIO client.")?;

        if !client.bucket_exists(&config.bucket).send().await?.exists {
            client
                .create_bucket(&config.bucket)
                .send()
                .await
                .context("Failed to create MinIO bucket.")?;
        }

        Ok(StorageProvider::Minio(StorageProviderMinio {
            client,
            bucket: config.bucket.clone(),
            id: id.to_string(),
        }))
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_content(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        timing: axum_server_timing::ServerTimingExtension,
        maybe_range: &Option<ContentRange>,
    ) -> Result<Body, StorageError> {
        let full_file_path = full_file_identifier.to_string();

        let mut get_object_query = self.client.get_object(&self.bucket, full_file_path);

        if let Some(range) = maybe_range {
            get_object_query = get_object_query
                .offset(Some(range.start))
                .length(Some(range.length()));
        };

        let get_object_response = with_timing!(
            get_object_query.send().await?,
            "MinIO operation to get file content",
            timing
        );

        let (stream, _size) = get_object_response.content.to_stream().await?;

        Ok(Body::from_stream(stream))
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_content_sha256_digest(
        &self,
        _full_file_identifier: &FileVersionIdentifier,
        _timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<String, StorageError> {
        // stream the content through the MinIO client and calculate the SHA256 digest

        let full_file_path = _full_file_identifier.to_string();
        let get_object_response = self
            .client
            .get_object(&self.bucket, full_file_path)
            .send()
            .await?;
        let (content_stream, _size) = get_object_response.content.to_stream().await?;
        let mut hasher = sha2::Sha256::new();
        let mut stream =
            content_stream.map_err(|e| tokio::io::Error::new(tokio::io::ErrorKind::Other, e));
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| tokio::io::Error::new(tokio::io::ErrorKind::Other, e))?;
            hasher.update(&chunk);
        }
        let digest = hasher.finalize();
        Ok(format!("{:x}", digest))
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_file_size(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<u64, StorageError> {
        let full_file_path = full_file_identifier.to_string();

        let get_object_response = with_timing!(
            self.client
                .get_object(&self.bucket, full_file_path)
                .send()
                .await,
            "MinIO operation to get file size",
            timing
        );

        match get_object_response {
            Ok(response) => Ok(u64::from(response.object_size)),
            Err(e) => {
                if e.to_string().contains("NoSuchKey") {
                    return Ok(0);
                }
                return Err(e.into());
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn delete_content(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), StorageError> {
        let full_file_path = full_file_identifier.to_string();
        with_timing!(
            self.client
                .delete_object(&self.bucket, full_file_path)
                .send()
                .await?,
            "MinIO operation to delete file content",
            timing
        );

        Ok(())
    }

    #[tracing::instrument(level = "trace")]
    pub async fn set_content(
        &self,
        full_file_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
        request: Request,
        mime_type: &str,
        offset: u64,
        length: u64,
    ) -> Result<(), StorageError> {
        let full_file_path = full_file_identifier.to_string();

        let get_object_result = with_timing!(
            self.client
                .get_object(&self.bucket, &full_file_path)
                .send()
                .await,
            "MinIO operation to get existing file content",
            timing
        );

        match get_object_result {
            Ok(get_object_response) => {
                let (existing_content_stream, _size) =
                    get_object_response.content.to_stream().await?;

                let existing_stream = existing_content_stream
                    .map_err(|e| tokio::io::Error::new(tokio::io::ErrorKind::Other, e));

                let new_content_stream = request
                    .into_body()
                    .into_data_stream()
                    .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

                let combined_stream = existing_stream.chain(new_content_stream);

                let total_size = offset + length;
                let object_content =
                    ObjectContent::new_from_stream(combined_stream, Some(total_size));

                with_timing!(
                    self.client
                        .put_object_content(&self.bucket, &full_file_path, object_content)
                        .content_type(mime_type.to_string())
                        .send()
                        .await?,
                    "MinIO operation to overwrite with continued file content",
                    timing
                );

                Ok(())
            }
            Err(e) => {
                if e.to_string().contains("NoSuchKey") {
                    if offset != 0 {
                        return Err(InnerStorageError::OffsetMismatch {
                            expected: offset,
                            calculated: 0,
                        }
                        .into());
                    }

                    let new_content_stream = request
                        .into_body()
                        .into_data_stream()
                        .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

                    let total_size = length;
                    let object_content =
                        ObjectContent::new_from_stream(new_content_stream, Some(total_size));

                    with_timing!(
                        self.client
                            .put_object_content(&self.bucket, full_file_path, object_content)
                            .content_type(mime_type.to_string())
                            .send()
                            .await?,
                        "MinIO operation to create new file content",
                        timing
                    );

                    return Ok(());
                }
                Err(e.into())
            }
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_health(&self) -> HealthStatus {
        match self.client.bucket_exists(&self.bucket).send().await {
            Ok(_) => HealthStatus {
                healthy: true,
                message: "Healthy".to_string(),
            },
            Err(e) => HealthStatus {
                healthy: false,
                message: e.to_string(),
            },
        }
    }
}
