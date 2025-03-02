use std::fmt::Debug;

use mows_common::reqwest_middleware;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ControllerError {
    #[error("SerializationError: {0}")]
    SerializationError(#[source] serde_json::Error),

    #[error("Kube Error: {0}")]
    KubeError(#[source] kube::Error),

    #[error("Finalizer Error: {0}")]
    // NB: awkward type because finalizer::Error embeds the reconciler error (which is this)
    // so boxing this error to break cycles
    FinalizerError(#[source] Box<kube::runtime::finalizer::Error<ControllerError>>),

    #[error("VaultError: {0}")]
    VaultError(#[source] vaultrs::error::ClientError),

    #[error("Generic: {0}")]
    GenericError(String),

    #[error("ReqwestMiddlewareError: {0}")]
    ReqwestMiddlewareError(#[source] reqwest_middleware::Error),

    #[error("ReqwestError: {0}")]
    ReqwestError(#[source] reqwest::Error),

    #[error("MowsError: {0}")]
    MowsError(#[source] mows_common::errors::MowsError),

    #[error("TonicStatusError: {0}")]
    TonicStatusError(#[source] tonic::Status),
}
pub type Result<T, E = ControllerError> = std::result::Result<T, E>;

// convert tonic status to error
impl From<tonic::Status> for ControllerError {
    fn from(error: tonic::Status) -> Self {
        ControllerError::TonicStatusError(error)
    }
}

impl ControllerError {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

impl From<reqwest_middleware::Error> for ControllerError {
    fn from(error: reqwest_middleware::Error) -> Self {
        ControllerError::ReqwestMiddlewareError(error)
    }
}

impl From<vaultrs::error::ClientError> for ControllerError {
    fn from(error: vaultrs::error::ClientError) -> Self {
        ControllerError::VaultError(error)
    }
}

impl From<mows_common::errors::MowsError> for ControllerError {
    fn from(error: mows_common::errors::MowsError) -> Self {
        ControllerError::MowsError(error)
    }
}

impl From<anyhow::Error> for ControllerError {
    fn from(error: anyhow::Error) -> Self {
        ControllerError::GenericError(error.to_string())
    }
}

impl From<reqwest::Error> for ControllerError {
    fn from(error: reqwest::Error) -> Self {
        ControllerError::ReqwestError(error)
    }
}

/// Expose all controller components used by main
pub mod controller;
pub use crate::controller::*;

/// Log and trace integrations

/// Metrics
mod metrics;
pub use metrics::Metrics;
pub mod handlers {
    pub mod raw;
}
pub mod config;
pub mod crd;
pub mod macros;
pub mod utils;
