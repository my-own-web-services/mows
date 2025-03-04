use crate::{config::config, ControllerError};
use anyhow::Context;
use mows_common::get_current_config_cloned;
use std::fmt::{Debug, Formatter};
use tonic::{
    service::{interceptor::InterceptedService, Interceptor},
    transport::{Certificate, Channel, ClientTlsConfig, Endpoint},
};
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};
use zitadel::{
    api::{
        clients::{BuildInterceptedService, ChannelConfig, ClientBuilder, ClientError},
        interceptors::ServiceAccountInterceptor,
        zitadel::management::v1::management_service_client::ManagementServiceClient,
    },
    credentials::ServiceAccount,
};

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

pub async fn create_zitadel_management_client() -> anyhow::Result<ManagementClient> {
    let config = get_current_config_cloned!(config());
    let service_account = ServiceAccount::load_from_json(&config.zitadel_service_account_token)
        .map_err(|e| anyhow::anyhow!("Failed to load service account: {}", e))?;

    let client_builder =
        ClientBuilder::new(&config.zitadel_api_endpoint).with_service_account(&service_account, None);

    let channel_config = ChannelConfig {
        ca_certificate_pem: config.ca_certificate_pem.to_string(),
        origin: config.zitadel_external_origin.to_string(),
        tls_domain_name: config.zitadel_tls_domain_name.to_string(),
    };

    let client = client_builder
        .build_management_client(&channel_config)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))?;

    Ok(client)
}
