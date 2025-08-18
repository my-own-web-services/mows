use thiserror_context::{impl_context, Context};

#[derive(Debug, thiserror::Error)]
pub enum InnerStorageError {
    #[error(transparent)]
    MinioError(#[from] minio::s3::error::Error),
    #[error("IO Error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Storage provider state for provider id {0} not found")]
    StorageProviderStateNotFound(String),
    #[error("Storage provider for app id {0} not found")]
    StorageProviderForAppNotFound(String),
    #[error("Size conversion error: {0}")]
    SizeConversionError(String),
    #[error("Digest mismatch: expected {expected}, got {calculated}")]
    DigestMismatch {
        expected: String,
        calculated: String,
    },
    #[error("Offset mismatch: expected {expected}, got {calculated}")]
    OffsetMismatch { expected: u64, calculated: u64 },
    #[error("Generic error: {0}")]
    GenericError(#[from] anyhow::Error),
    #[error("Secret not found from reference: {0}")]
    SecretNotFound(String),
    #[error("Axum error: {0}")]
    AxumError(#[from] axum::Error),
}

impl_context!(StorageError(InnerStorageError));
