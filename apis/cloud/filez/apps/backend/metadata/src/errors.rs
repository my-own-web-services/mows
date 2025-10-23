use filez_server_client::types::JobType;
use thiserror_context::{impl_context, Context};

#[derive(Debug, thiserror::Error)]
pub enum InnerMetadataError {
    #[error("The given job type is not supported by this app.")]
    UnsupportedJobType(JobType),
    #[error("Parse error: {0}")]
    ParseError(#[from] serde_json::Error),
    #[error("Filez client error: {0}")]
    FilezClientError(#[from] filez_server_client::client::ApiClientError),
    #[error("IO error: {0}")]
    IoError(#[from] tokio::io::Error),
    #[error("Generic error: {0}")]
    GenericError(#[from] anyhow::Error),
    #[error("Exiftool error: {0}")]
    ExiftoolError(String),
}

impl_context!(MetadataError(InnerMetadataError));
