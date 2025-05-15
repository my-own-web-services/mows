use std::fmt::{Debug, Formatter};

use anyhow::Context;
use mows_common_rust::get_current_config_cloned;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};

use crate::{config::config, ControllerError};
struct TypedDebugWrapper<'a, T: ?Sized>(&'a T);

impl<T: Debug> Debug for TypedDebugWrapper<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}::{:?}", core::any::type_name::<T>(), self.0)
    }
}

trait TypedDebug: Debug {
    fn typed_debug(&self) -> TypedDebugWrapper<'_, Self> {
        TypedDebugWrapper(self)
    }
}

impl<T: ?Sized + Debug> TypedDebug for T {}

pub fn get_error_type(e: &ControllerError) -> String {
    let reason = format!("{:?}", e.typed_debug());
    let reason = reason.split_at(reason.find('(').unwrap_or(0)).0;
    reason.to_string()
}

pub async fn create_vault_client() -> Result<VaultClient, ControllerError> {
    let mut client_builder = VaultClientSettingsBuilder::default();

    let config = get_current_config_cloned!(config());

    client_builder.address(config.vault_url);

    let vc = VaultClient::new(client_builder.build().map_err(|_| {
        ControllerError::GenericError(anyhow::anyhow!("Failed to create vault client settings builder"))
    })?)?;

    let service_account_jwt = std::fs::read_to_string(config.service_account_token_path)
        .context("Failed to read service account token")?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        &config.vault_kubernetes_auth_path,
        &config.vault_kubernetes_auth_role,
        &service_account_jwt,
    )
    .await?;

    let vc = VaultClient::new(
        client_builder
            .token(&vault_auth.client_token)
            .build()
            .context("Failed to create vault client")?,
    )?;

    Ok(vc)
}
