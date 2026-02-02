pub mod file;
pub mod vault;

use crate::resource_types::RawZitadelApplicationClientDataTarget;
use crate::ControllerError;

/// Dispatch credential storage to the appropriate target handler.
pub async fn handle_client_data_target(
    target: &RawZitadelApplicationClientDataTarget,
    resource_scope: &str,
    data: serde_json::Value,
) -> Result<(), ControllerError> {
    match target {
        RawZitadelApplicationClientDataTarget::Vault(vault_target) => {
            vault::handle_vault_target(vault_target, resource_scope, data).await
        }
        RawZitadelApplicationClientDataTarget::File(file_target) => {
            file::handle_file_target(file_target, data).await
        }
    }
}
