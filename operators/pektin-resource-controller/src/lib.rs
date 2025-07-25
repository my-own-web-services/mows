use std::fmt::Debug;

use mows_common_rust::reqwest_middleware;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("SerializationError: {0}")]
    SerializationError(#[source] serde_json::Error),

    #[error("Kube Error: {0}")]
    KubeError(#[source] kube::Error),

    #[error("Finalizer Error: {0}")]
    FinalizerError(#[source] Box<kube::runtime::finalizer::Error<Error>>),

    #[error("VaultError: {0}")]
    VaultError(#[source] vaultrs::error::ClientError),

    #[error("Generic: {0}")]
    GenericError(String),

    #[error("ReqwestMiddlewareError: {0}")]
    ReqwestMiddlewareError(#[source] reqwest_middleware::Error),

    #[error("ReqwestError: {0}")]
    ReqwestError(#[source] reqwest::Error),

    #[error("MowsError: {0}")]
    MowsError(#[source] mows_common_rust::errors::MowsError),
}
pub type Result<T, E = Error> = std::result::Result<T, E>;

impl Error {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

impl From<reqwest_middleware::Error> for Error {
    fn from(error: reqwest_middleware::Error) -> Self {
        Error::ReqwestMiddlewareError(error)
    }
}

impl From<vaultrs::error::ClientError> for Error {
    fn from(error: vaultrs::error::ClientError) -> Self {
        Error::VaultError(error)
    }
}

impl From<mows_common_rust::errors::MowsError> for Error {
    fn from(error: mows_common_rust::errors::MowsError) -> Self {
        Error::MowsError(error)
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

/// Metrics
mod metrics;
pub use metrics::Metrics;
pub mod kube_fix;
pub mod reconcile {
    pub mod plain;
}
pub mod config;
pub mod crd;
pub mod macros;
pub mod utils;
