use gtmpl::{
    error::{ExecError, ParseError},
    FuncError,
};
use thiserror::Error;

#[derive(Error, Debug)]
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

    #[error("TemplateParseError: {0}")]
    TemplateParseError(#[source] ParseError),

    #[error("TemplateFuncError: {0}")]
    TemplateFuncError(#[source] FuncError),

    #[error("TemplateExecError: {0}")]
    TemplateExecError(#[source] ExecError),
}
pub type Result<T, E = Error> = std::result::Result<T, E>;

impl Error {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

impl From<ParseError> for Error {
    fn from(error: ParseError) -> Self {
        Error::TemplateParseError(error)
    }
}

impl From<ExecError> for Error {
    fn from(error: ExecError) -> Self {
        Error::TemplateExecError(error)
    }
}

impl From<FuncError> for Error {
    fn from(error: FuncError) -> Self {
        Error::TemplateFuncError(error)
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

/// Expose all controller components used by main
pub mod controller;
pub use crate::controller::*;

/// Log and trace integrations
pub mod telemetry;

/// Metrics
mod metrics;
pub use metrics::Metrics;
pub mod reconcile {
    pub mod auth;
    pub mod policy;
    pub mod secret_engine;
}

pub mod templating {
    pub mod funcs;
}
