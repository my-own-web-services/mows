use std::fmt::Debug;

use mows_common_rust::{reqwest_middleware, vault::ManagedVaultError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ControllerError {
    #[error("SerializationError: {0}")]
    SerializationError(#[source] serde_json::Error),

    #[error("Kube Error: {0}")]
    KubeError(#[source] kube::Error),

    #[error("Finalizer Error: {0}")]
    FinalizerError(#[source] Box<kube::runtime::finalizer::Error<ControllerError>>),

    #[error("VaultError: {0}")]
    VaultError(#[from] ManagedVaultError),

    #[error("Generic: {0}")]
    GenericError(String),

    #[error("ReqwestMiddlewareError: {0}")]
    ReqwestMiddlewareError(#[source] reqwest_middleware::Error),

    #[error("ReqwestError: {0}")]
    ReqwestError(#[source] reqwest::Error),

    #[error("MowsError: {0}")]
    MowsError(#[source] mows_common_rust::errors::MowsError),
}
pub type Result<T, E = ControllerError> = std::result::Result<T, E>;

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

impl From<mows_common_rust::errors::MowsError> for ControllerError {
    fn from(error: mows_common_rust::errors::MowsError) -> Self {
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
pub mod kube_fix;
pub mod reconcile {
    pub mod plain;
}
pub mod config;
pub mod crd;
pub mod macros;
pub mod utils;
