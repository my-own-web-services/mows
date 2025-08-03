use filez_client::types::JobType;

#[derive(Debug, thiserror::Error)]
pub enum ImageError {
    #[error("The given job type is not supported by this app.")]
    UnsupportedJobType(JobType),
    #[error("Parse error: {0}")]
    ParseError(#[from] serde_json::Error),
    #[error("Filez client error: {0}")]
    FilezClientError(#[from] filez_client::client::ApiClientError),
    #[error("IO error: {0}")]
    IoError(#[from] tokio::io::Error),
    #[error("Generic error: {0}")]
    GenericError(#[from] anyhow::Error),
    #[error("Image processing error: {0}")]
    ImageProcessingError(#[from] image::ImageError),
}
