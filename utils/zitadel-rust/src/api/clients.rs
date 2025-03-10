//! Module with convenience functions to create clients for ZITADEL
//! API access. When the credentials feature is enabled, additional
//! modules provide access to functions that create clients with
//! specific interceptors for authentication.

use std::error::Error;

use custom_error::custom_error;
use tonic::codegen::{Body, Bytes, InterceptedService, StdError};
use tonic::service::Interceptor;

use tonic::transport::{Channel, Endpoint};

#[cfg(feature = "interceptors")]
use crate::api::interceptors::{AccessTokenInterceptor, ServiceAccountInterceptor};

#[cfg(feature = "api-oidc-v2")]
use crate::api::zitadel::oidc::v2::oidc_service_client::OidcServiceClient;
#[cfg(feature = "api-org-v2")]
use crate::api::zitadel::org::v2::organization_service_client::OrganizationServiceClient;
#[cfg(feature = "api-session-v2")]
use crate::api::zitadel::session::v2::session_service_client::SessionServiceClient;
#[cfg(feature = "api-settings-v2")]
use crate::api::zitadel::settings::v2::settings_service_client::SettingsServiceClient;
#[cfg(feature = "api-user-v2")]
use crate::api::zitadel::user::v2::user_service_client::UserServiceClient;

#[cfg(feature = "api-admin-v1")]
use crate::api::zitadel::admin::v1::admin_service_client::AdminServiceClient;
#[cfg(feature = "api-auth-v1")]
use crate::api::zitadel::auth::v1::auth_service_client::AuthServiceClient;
#[cfg(feature = "api-management-v1")]
use crate::api::zitadel::management::v1::management_service_client::ManagementServiceClient;
#[cfg(feature = "api-system-v1")]
use crate::api::zitadel::system::v1::system_service_client::SystemServiceClient;

#[cfg(feature = "interceptors")]
use crate::credentials::{AuthenticationOptions, ServiceAccount};

custom_error! {
    /// Errors that may occur when creating a client.
    pub ClientError
        InvalidUrl = "the provided url is invalid",
        ConnectionError = "could not connect to provided endpoint",
        TlsInitializationError = "could not setup tls connection",
}

#[derive(Debug)]
pub struct ChannelConfig {
    pub origin: String,
}

/// A builder to create configured gRPC clients for ZITADEL API access.
/// The builder accepts the api endpoint and (depending on activated features)
/// an authentication method.
pub struct ClientBuilder<T: BuildInterceptedService = NoInterceptor> {
    api_endpoint: String,
    interceptor: T,
}

pub trait BuildInterceptedService {
    type Target;
    fn build_service(self, channel: Channel) -> Self::Target;
}

pub struct NoInterceptor;

impl BuildInterceptedService for NoInterceptor {
    type Target = Channel;
    fn build_service(self, channel: Channel) -> Self::Target {
        channel
    }
}

impl<T> BuildInterceptedService for T
where
    T: Interceptor,
{
    type Target = InterceptedService<Channel, T>;
    fn build_service(self, channel: Channel) -> Self::Target {
        InterceptedService::new(channel, self)
    }
}

impl ClientBuilder<NoInterceptor> {
    /// Create a new client builder with the provided endpoint.
    pub fn new(api_endpoint: &str) -> ClientBuilder<NoInterceptor> {
        ClientBuilder {
            api_endpoint: api_endpoint.to_string(),
            interceptor: NoInterceptor,
        }
    }

    /// Configure the client builder to inject a custom interceptor,
    /// which can be used to modify the [Request][tonic::request::Request] before being sent.
    ///
    /// See [Interceptor][tonic::service::Interceptor] for more details.
    pub fn with_interceptor<I: Interceptor>(self, interceptor: I) -> ClientBuilder<I> {
        ClientBuilder {
            api_endpoint: self.api_endpoint,
            interceptor,
        }
    }

    /// Configure the client builder to use a provided access token.
    /// This can be a pre-fetched token from ZITADEL or some other form
    /// of a valid access token like a personal access token (PAT).
    ///
    /// Clients with this authentication method will have the [`AccessTokenInterceptor`]
    /// attached.
    #[cfg(feature = "interceptors")]
    pub fn with_access_token_and_org(
        self,
        access_token: &str,
        org_id: Option<&str>,
    ) -> ClientBuilder<AccessTokenInterceptor> {
        self.with_interceptor(AccessTokenInterceptor::new(access_token, org_id))
    }

    /// Configure the client builder to use a [`ServiceAccount`][crate::credentials::ServiceAccount].
    /// The service account will be used to fetch a valid access token from ZITADEL.
    ///
    /// Clients with this authentication method will have the
    /// [`ServiceAccountInterceptor`][crate::api::interceptors::ServiceAccountInterceptor] attached
    /// that fetches an access token from ZITADEL and renewes it when it expires.
    #[cfg(feature = "interceptors")]
    pub fn with_service_account(
        self,
        service_account: &ServiceAccount,
        auth_options: Option<AuthenticationOptions>,
    ) -> ClientBuilder<ServiceAccountInterceptor> {
        let interceptor = ServiceAccountInterceptor::new(
            &self.api_endpoint,
            service_account,
            auth_options.clone(),
        );
        self.with_interceptor(interceptor)
    }
}

impl<T> ClientBuilder<T>
where
    T: BuildInterceptedService,
    T::Target: tonic::client::GrpcService<tonic::body::BoxBody>,
    <T::Target as tonic::client::GrpcService<tonic::body::BoxBody>>::ResponseBody:
        Body<Data = Bytes> + Send + 'static,
    <<T::Target as tonic::client::GrpcService<tonic::body::BoxBody>>::ResponseBody as Body>::Error:
        Into<StdError> + Send,
{
    /// Create a new [`AdminServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-admin-v1")]
    pub async fn build_admin_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<AdminServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(AdminServiceClient::new(channel))
    }

    /// Create a new [`AuthServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-auth-v1")]
    pub async fn build_auth_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<AuthServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(AuthServiceClient::new(channel))
    }

    /// Create a new [`ManagementServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-management-v1")]
    pub async fn build_management_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<ManagementServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);

        Ok(ManagementServiceClient::new(channel))
    }

    /// Create a new [`OidcServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-oidc-v2")]
    pub async fn build_oidc_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<OidcServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(OidcServiceClient::new(channel))
    }

    /// Create a new [`OrganizationServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-org-v2")]
    pub async fn build_organization_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<OrganizationServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(OrganizationServiceClient::new(channel))
    }

    /// Create a new [`SessionServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-session-v2")]
    pub async fn build_session_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<SessionServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(SessionServiceClient::new(channel))
    }

    /// Create a new [`SettingsServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-settings-v2")]
    pub async fn build_settings_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<SettingsServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(SettingsServiceClient::new(channel))
    }

    /// Create a new [`SystemServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-system-v1")]
    pub async fn build_system_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<SystemServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(SystemServiceClient::new(channel))
    }

    /// Create a new [`UserServiceClient`].
    ///
    /// ### Errors
    ///
    /// This function returns a [`ClientError`] if the provided API endpoint
    /// cannot be parsed into a valid URL or if the connection to the endpoint
    /// is not possible.
    #[cfg(feature = "api-user-v2")]
    pub async fn build_user_client(
        self,
        channel_config: &ChannelConfig,
    ) -> Result<UserServiceClient<T::Target>, Box<dyn Error>> {
        let channel = self
            .interceptor
            .build_service(get_channel(&self.api_endpoint, channel_config).await?);
        Ok(UserServiceClient::new(channel))
    }
}

async fn get_channel(
    api_endpoint: &str,
    channel_config: &ChannelConfig,
) -> anyhow::Result<Channel> {
    Ok(Endpoint::from_shared(api_endpoint.to_string())?
        .origin(channel_config.origin.parse()?)
        .connect_lazy())
}
