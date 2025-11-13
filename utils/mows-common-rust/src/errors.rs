use thiserror::Error;

use crate::config::MowsConfigError;

#[derive(Debug, Error)]
pub enum MowsError {
    #[error(transparent)]
    MowsConfigError(MowsConfigError),
    #[error("Generic error: {0}")]
    GenericError(String),
}
