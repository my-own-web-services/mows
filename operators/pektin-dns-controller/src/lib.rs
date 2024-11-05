use std::fmt::{Debug, Formatter};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("SerializationError: {0}")]
    SerializationError(#[source] serde_json::Error),

    #[error("Kube Error: {0}")]
    KubeError(#[source] kube::Error),

    #[error("Finalizer Error: {0}")]
    // NB: awkward type because finalizer::Error embeds the reconciler error (which is this)
    // so boxing this error to break cycles
    FinalizerError(#[source] Box<kube::runtime::finalizer::Error<Error>>),

    #[error("VaultError: {0}")]
    VaultError(#[source] vaultrs::error::ClientError),

    #[error("Generic: {0}")]
    GenericError(String),

    #[error("ReqwestError: {0}")]
    ReqwestError(#[source] reqwest::Error),
}
pub type Result<T, E = Error> = std::result::Result<T, E>;

impl Error {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

impl From<vaultrs::error::ClientError> for Error {
    fn from(error: vaultrs::error::ClientError) -> Self {
        Error::VaultError(error)
    }
}

impl From<anyhow::Error> for Error {
    fn from(error: anyhow::Error) -> Self {
        Error::GenericError(error.to_string())
    }
}

impl From<reqwest::Error> for Error {
    fn from(error: reqwest::Error) -> Self {
        Error::ReqwestError(error)
    }
}

/// Expose all controller components used by main
pub mod controller;
pub use crate::controller::*;

/// Log and trace integrations
pub mod telemetry;

/// Metrics
mod metrics;
pub use metrics::Metrics;
pub mod kube_fix;
pub mod reconcile {
    pub mod plain;
}
pub mod config;
pub mod macros;
pub mod utils;
