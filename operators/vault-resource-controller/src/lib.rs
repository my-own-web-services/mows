use gtmpl_value::FuncError;
use mows_common_rust::templating::gtmpl::error::{ExecError, ParseError};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ControllerError {
    #[error("Serialization Error: {0}")]
    SerializationError(#[source] serde_json::Error),

    #[error("Kube Error: {0}")]
    KubeError(#[source] kube::Error),

    #[error("Finalizer Error: {0}")]
    // NB: awkward type because finalizer::Error embeds the reconciler error (which is this)
    // so boxing this error to break cycles
    FinalizerError(#[source] Box<kube::runtime::finalizer::Error<ControllerError>>),

    #[error("Vault Error: {0}")]
    VaultError(#[from] vaultrs::error::ClientError),

    #[error("Generic Error: {0}")]
    GenericError(#[from] anyhow::Error),

    #[error("TemplateParseError: {0}")]
    TemplateParseError(#[from] ParseError),

    #[error("TemplateFuncError: {0}")]
    TemplateFuncError(#[from] FuncError),

    #[error("TemplateExecError: {0}")]
    TemplateExecError(#[from] ExecError),
}

pub type Result<T, E = ControllerError> = std::result::Result<T, E>;

impl ControllerError {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

/// Expose all controller components used by main
pub mod controller;
pub use crate::controller::*;

/// Metrics
mod metrics;
pub use metrics::Metrics;
pub mod config;
pub mod macros;
pub mod utils;
pub mod handlers {
    pub mod auth_engine;
    pub mod policy;
    pub mod secret_engine;
    pub mod secret_sync;
}

pub mod crd;
