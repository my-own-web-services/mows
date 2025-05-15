use thiserror::Error;

#[derive(Debug, Error)]
pub enum MowsError {
    #[error("Config error: {0}")]
    ConfigError(String),
    #[error("Generic error: {0}")]
    GenericError(String),
}
