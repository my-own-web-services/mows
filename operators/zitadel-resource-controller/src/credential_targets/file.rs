use std::path::Path;

use crate::{resource_types::ClientDataTargetFile, ControllerError};
use tracing::instrument;

/// Validate that a file path does not contain path traversal components.
fn validate_path(path: &str) -> Result<(), ControllerError> {
    let path = Path::new(path);

    for component in path.components() {
        if let std::path::Component::ParentDir = component {
            return Err(ControllerError::GenericError(format!(
                "Path traversal detected in credential file path: '{}' contains '..' component",
                path.display()
            )));
        }
    }

    if !path.is_absolute() {
        return Err(ControllerError::GenericError(format!(
            "Credential file path must be absolute, got: '{}'",
            path.display()
        )));
    }

    Ok(())
}

#[instrument(level = "trace")]
pub async fn handle_file_target(
    file_target: &ClientDataTargetFile,
    data: serde_json::Value,
) -> Result<(), ControllerError> {
    validate_path(&file_target.path)?;

    let content =
        serde_json::to_string_pretty(&data).map_err(ControllerError::SerializationError)?;

    if let Some(parent) = Path::new(&file_target.path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            ControllerError::GenericError(format!(
                "Failed to create directory {}: {}",
                parent.display(),
                e
            ))
        })?;
    }

    tokio::fs::write(&file_target.path, content)
        .await
        .map_err(|e| {
            ControllerError::GenericError(format!(
                "Failed to write credentials file {}: {}",
                file_target.path, e
            ))
        })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_path_rejects_traversal() {
        assert!(validate_path("/data/../etc/passwd").is_err());
        assert!(validate_path("/data/credentials/../../etc/shadow").is_err());
    }

    #[test]
    fn test_validate_path_rejects_relative() {
        assert!(validate_path("data/credentials/creds.json").is_err());
        assert!(validate_path("../etc/passwd").is_err());
    }

    #[test]
    fn test_validate_path_accepts_valid_absolute() {
        assert!(validate_path("/data/credentials/argocd.json").is_ok());
        assert!(validate_path("/tmp/creds.json").is_ok());
    }
}
