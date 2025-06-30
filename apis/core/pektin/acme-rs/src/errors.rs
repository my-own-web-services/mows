#[derive(Debug, thiserror::Error)]
pub enum AcmeClientError {
    #[error("HTTP request failed: {0}")]
    HttpRequest(#[from] reqwest::Error),

    #[error("JSON serialization/deserialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Invalid URL: {0}")]
    InvalidUrl(#[from] url::ParseError),

    #[error("Generic error: {0}")]
    Generic(#[from] anyhow::Error),
}
