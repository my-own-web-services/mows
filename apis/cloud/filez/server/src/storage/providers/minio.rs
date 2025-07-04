use crate::{
    controller::crd::ValueOrSecretReference, models::files::FilezFile,
    storage::errors::StorageError, with_timing,
};
use anyhow::Context;
use axum::body::Body;
use axum::extract::Request;
use bigdecimal::{BigDecimal, ToPrimitive};
use futures::StreamExt;
use futures_util::TryStreamExt;
use minio::s3::{builders::ObjectContent, types::S3Api};
use minio::s3::{creds::StaticProvider, http::BaseUrl, ClientBuilder};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    str::FromStr,
    sync::{Arc, Mutex},
};
use utoipa::ToSchema;

use super::StorageProvider;

#[derive(Debug, Clone, Serialize, ToSchema, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct StorageProviderConfigMinio {
    pub endpoint: String,
    pub username: String,
    pub password: String,
    pub bucket: String,
}

#[derive(Debug, Clone, Serialize, ToSchema, Deserialize, JsonSchema, PartialEq, Eq)]
pub struct StorageProviderConfigMinioCrd {
    pub endpoint: ValueOrSecretReference,
    pub username: ValueOrSecretReference,
    pub password: ValueOrSecretReference,
    pub bucket: ValueOrSecretReference,
}

#[derive(Debug, Clone)]
pub struct StorageProviderMinio {
    pub client: minio::s3::Client,
    pub bucket: String,
    pub id: String,
}

impl StorageProviderMinio {
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

        Ok(StorageProvider::Minio(StorageProviderMinio {
            client,
            bucket: config.bucket.clone(),
            id: id.to_string(),
        }))
    }

    pub async fn get_content(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<Body, StorageError> {
        let mut get_object_query = self.client.get_object(&self.bucket, full_file_path);

        if let Some((start, end)) = range {
            get_object_query = get_object_query
                .offset(*start)
                .length(end.map(|e| e - start.unwrap_or(0) + 1));
        };

        let get_object_response = with_timing!(
            get_object_query.send().await?,
            "MinIO operation to get file content",
            timing
        );

        let (stream, _size) = get_object_response.content.to_stream().await?;

        Ok(Body::from_stream(stream))
    }

    pub async fn get_file_size(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, StorageError> {
        let get_object_response = with_timing!(
            self.client
                .get_object(&self.bucket, full_file_path)
                .send()
                .await?,
            "MinIO operation to get file size",
            timing
        );

        let object_size = BigDecimal::from(get_object_response.object_size);

        Ok(object_size)
    }

    // pub async fn continue_file_creation(
    //     &self,
    //     file: &FilezFile,
    //     request: Request,
    //     timing: axum_server_timing::ServerTimingExtension,
    //     offset: u64,
    //     length: u64,
    // ) -> Result<(), StorageError> {
    //     todo!();

    //     let object_id = file.id.to_string();

    //     let get_object_response = with_timing!(
    //         self.client
    //             .get_object(&self.bucket, &object_id)
    //             .send()
    //             .await?,
    //         "MinIO operation to get existing file content for continuation",
    //         timing
    //     );

    //     if get_object_response.object_size != offset {
    //         return Err(StorageError::OffsetMismatch {
    //             expected: offset,
    //             calculated: get_object_response.object_size,
    //         });
    //     }

    //     let (existing_content_stream, _size) = get_object_response.content.to_stream().await?;

    //     let existing_stream = existing_content_stream
    //         .map_err(|e| tokio::io::Error::new(tokio::io::ErrorKind::Other, e));

    //     let new_content_stream = request
    //         .into_body()
    //         .into_data_stream()
    //         .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

    //     let combined_stream = existing_stream.chain(new_content_stream);

    //     let total_size = offset + length;
    //     let object_content = ObjectContent::new_from_stream(combined_stream, Some(total_size));

    //     with_timing!(
    //         self.client
    //             .put_object_content(&self.bucket, &object_id, object_content)
    //             .content_type(file.mime_type.clone())
    //             .send()
    //             .await?,
    //         "MinIO operation to overwrite with continued file content",
    //         timing
    //     );
    //     Ok(())
    // }

    // pub async fn create_file(
    //     &self,
    //     file: &FilezFile,
    //     request: Request,
    //     timing: axum_server_timing::ServerTimingExtension,
    //     sha256_digest: Option<String>,
    // ) -> Result<(), StorageError> {
    //     todo!();

    //     if let Some(expected_digest) = sha256_digest {
    //         let hash_creator = Arc::new(Mutex::new(Sha256::new()));

    //         let stream_body = request.into_body().into_data_stream();

    //         let hash_creator_clone = Arc::clone(&hash_creator);
    //         let instrumented_stream = stream_body.map_ok(move |chunk| {
    //             hash_creator_clone.lock().unwrap().update(&chunk);
    //             chunk
    //         });

    //         let stream = instrumented_stream
    //             .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

    //         let object_content = ObjectContent::new_from_stream(stream, file.size.to_u64());

    //         with_timing!(
    //             self.client
    //                 .put_object_content(&self.bucket, &file.id.to_string(), object_content)
    //                 .content_type(file.mime_type.clone())
    //                 .send()
    //                 .await?,
    //             "MinIO operation to upload the file content",
    //             timing
    //         );

    //         let calculated_hash = Arc::try_unwrap(hash_creator)
    //             .expect("Arc should have only one strong reference")
    //             .into_inner()
    //             .expect("Mutex should not be poisoned")
    //             .finalize();

    //         let calculated_digest_hex = format!("{:x}", calculated_hash);

    //         if !calculated_digest_hex.eq_ignore_ascii_case(&expected_digest) {
    //             return Err(StorageError::DigestMismatch {
    //                 expected: expected_digest,
    //                 calculated: calculated_digest_hex,
    //             });
    //         }
    //     } else {
    //         let stream = request
    //             .into_body()
    //             .into_data_stream()
    //             .map_err(|err| tokio::io::Error::new(tokio::io::ErrorKind::Other, err));

    //         let object_content = ObjectContent::new_from_stream(stream, file.size.to_u64());

    //         with_timing!(
    //             self.client
    //                 .put_object_content(&self.bucket, &file.id.to_string(), object_content)
    //                 .content_type(file.mime_type.clone())
    //                 .send()
    //                 .await?,
    //             "MinIO operation to upload the file content",
    //             timing
    //         );
    //     }

    //     Ok(())
    // }

    pub async fn get_health(&self) -> anyhow::Result<String> {
        self.client
            .bucket_exists(&self.bucket)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("MinIO health check failed: {}", e))?;
        Ok("MinIO is healthy".to_string())
    }
}
