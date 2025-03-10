use crate::{config::config, ControllerError};
use anyhow::Context;
use mows_common::get_current_config_cloned;
use std::fmt::{Debug, Formatter};
use tonic::{service::interceptor::InterceptedService, transport::Channel};
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};
use zitadel::api::{
    clients::{ChannelConfig, ClientBuilder},
    interceptors::AccessTokenInterceptor,
    zitadel::{
        admin::v1::admin_service_client::AdminServiceClient,
        management::v1::management_service_client::ManagementServiceClient,
    },
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

pub type ManagementClient = ManagementServiceClient<InterceptedService<Channel, AccessTokenInterceptor>>;
pub type AdminClient = AdminServiceClient<InterceptedService<Channel, AccessTokenInterceptor>>;

pub struct ZitadelClient {
    pub api_endpoint: String,
    pub pa_token: String,
    pub external_origin: String,
}

impl ZitadelClient {
    pub async fn new() -> anyhow::Result<ZitadelClient> {
        let config = get_current_config_cloned!(config());

        Ok(ZitadelClient {
            api_endpoint: config.zitadel_api_endpoint,
            pa_token: config.zitadel_pa_token,
            external_origin: config.zitadel_external_origin,
        })
    }

    pub async fn management_client(&self, org_id: Option<&str>) -> anyhow::Result<ManagementClient> {
        let client_builder =
            ClientBuilder::new(&self.api_endpoint).with_access_token_and_org(&self.pa_token.trim(), org_id);

        let channel_config = ChannelConfig {
            origin: self.external_origin.to_string(),
        };

        client_builder
            .build_management_client(&channel_config)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))
    }

    pub async fn admin_client(&self, org_id: Option<&str>) -> anyhow::Result<AdminClient> {
        let client_builder =
            ClientBuilder::new(&self.api_endpoint).with_access_token_and_org(&self.pa_token.trim(), org_id);

        let channel_config = ChannelConfig {
            origin: self.external_origin.to_string(),
        };

        client_builder
            .build_admin_client(&channel_config)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))
    }
}
