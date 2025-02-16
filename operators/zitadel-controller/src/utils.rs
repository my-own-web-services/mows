use std::fmt::{Debug, Formatter};

use anyhow::Context;
use mows_common::get_current_config_cloned;
use prometheus_client::metrics::info;
use serde_json::Value;
use tonic::{service::interceptor::InterceptedService, transport::Channel};
use tracing::{debug, field::debug, info};
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};
use zitadel::{
    api::{
        clients::ClientBuilder, interceptors::ServiceAccountInterceptor,
        zitadel::management::v1::management_service_client::ManagementServiceClient,
    },
    credentials::ServiceAccount,
};

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

pub async fn get_zitadel_password_secret() -> Result<String, ControllerError> {
    let config = get_current_config_cloned!(config());
    let vault_client = create_vault_client().await?;

    let secret: Value = vaultrs::kv2::read(
        &vault_client,
        &config.zitadel_secrets_engine_name,
        &config.zitadel_secrets_path,
    )
    .await?;

    info!("Got secret from vault: {}", secret);

    Ok(secret
        .get("adminPassword")
        .context("Failed to get admin password")?
        .as_str()
        .context("Failed to get admin password")?
        .to_string())
}

pub async fn create_vault_client() -> Result<VaultClient, ControllerError> {
    let mut client_builder = VaultClientSettingsBuilder::default();

    let config = get_current_config_cloned!(config());

    client_builder.address(config.vault_uri);

    let vc = VaultClient::new(client_builder.build().map_err(|_| {
        ControllerError::GenericError("Failed to create vault client settings builder".to_string())
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

pub type ManagementClient = ManagementServiceClient<InterceptedService<Channel, ServiceAccountInterceptor>>;

pub async fn create_new_zitadel_management_client() -> anyhow::Result<ManagementClient> {
    let config = get_current_config_cloned!(config());
    let service_account = ServiceAccount::load_from_file(&config.service_account_token_path).unwrap();
    let client_builder =
        ClientBuilder::new(&config.zitadel_endpoint).with_service_account(&service_account, None);

    let client = client_builder.build_management_client().await.unwrap();

    Ok(client)
}
