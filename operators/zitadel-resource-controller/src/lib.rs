use handlers::raw::ZitadelResourceRawError;
use mows_common_rust::reqwest_middleware;
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

    #[error("MowsError: {0}")]
    MowsError(#[source] mows_common_rust::errors::MowsError),

    #[error("TonicStatusError: {0}")]
    TonicStatusError(#[source] tonic::Status),

    #[error("ZitadelResourceRawError: {0}")]
    ZitadelResourceRawError(#[from] ZitadelResourceRawError),
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

/// Expose all controller components used by main
pub mod controller;
pub use crate::controller::*;

/// Metrics
mod metrics;
pub use metrics::Metrics;
pub mod handlers {
    pub mod raw;
}
pub mod config;
pub mod credential_targets;
pub mod crd;
pub mod provider;
pub mod resource_types;
pub mod utils;
pub mod zitadel_client;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metric_label_generic_error() {
        let err = ControllerError::GenericError("test error".to_string());
        let label = err.metric_label();
        assert!(label.contains("genericerror"), "Expected lowercase variant name in metric label, got '{}'", label);
    }

    #[test]
    fn test_metric_label_tonic_error() {
        let err = ControllerError::TonicStatusError(tonic::Status::internal("oops"));
        let label = err.metric_label();
        assert!(label.contains("tonicstatuserror"), "Expected lowercase variant name in metric label, got '{}'", label);
    }

    #[test]
    fn test_from_tonic_status() {
        let status = tonic::Status::permission_denied("forbidden");
        let err: ControllerError = status.into();
        assert!(matches!(err, ControllerError::TonicStatusError(_)));
        assert!(err.to_string().contains("forbidden"));
    }

    #[test]
    fn test_from_anyhow_error() {
        let anyhow_err = anyhow::anyhow!("something broke");
        let err: ControllerError = anyhow_err.into();
        assert!(matches!(err, ControllerError::GenericError(_)));
        assert!(err.to_string().contains("something broke"));
    }

    #[test]
    fn test_from_vault_error() {
        let vault_err = vaultrs::error::ClientError::APIError {
            code: 403,
            errors: vec!["permission denied".to_string()],
        };
        let err: ControllerError = vault_err.into();
        assert!(matches!(err, ControllerError::VaultError(_)));
    }

    #[test]
    fn test_error_display_generic() {
        let err = ControllerError::GenericError("detail message".to_string());
        let display = format!("{}", err);
        assert_eq!(display, "Generic: detail message");
    }

    #[test]
    fn test_error_display_serialization() {
        let serde_err = serde_json::from_str::<String>("bad").unwrap_err();
        let msg = serde_err.to_string();
        let err = ControllerError::SerializationError(serde_err);
        let display = format!("{}", err);
        assert!(display.contains(&msg));
    }
}
