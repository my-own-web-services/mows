use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use zitadel::api::zitadel::app::v1::ApiAuthMethodType;

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "ZitadelResource",
    group = "zitadel.k8s.mows.cloud",
    version = "v1",
    namespaced
)]
#[kube(status = "ZitadelResourceStatus", shortname = "zrs")]
#[serde(rename_all = "camelCase")]
pub enum ZitadelResourceSpec {
    Raw(RawZitadelResource),
}

/// The status object of `ZitadelResource`
#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct ZitadelResourceStatus {
    pub created: bool,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelResource {
    pub resource: RawZitadelResourceSelector,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelResourceSelector {
    Org(RawZitadelOrg),
    Project(RawZitadelProject),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelOrg {
    pub name: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelProject {
    pub org_name: String,
    pub name: String,
    pub project_role_assertion: bool,
    pub project_role_check: bool,
    pub roles: Vec<RawZitadelProjectRole>,
    /// the roles to assign to the "zitadel-admin"
    pub admin_roles: Vec<String>,
    pub applications: Vec<RawZitadelApplication>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelProjectRole {
    pub key: String,
    pub display_name: String,
    pub group: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelApplication {
    pub name: String,
    pub client_data_target: RawZitadelApplicationClientDataTarget,
    pub method: RawZitadelApplicationMethod,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelApplicationClientDataTarget {
    Vault(ClientDataTargetVault),
    //Kubernetes(ClientDataTargetKubernetes),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClientDataTargetVault {
    /// The name of the vault engine in the same namespace mows-core-secrets-vrc/{RESOURCE_NAMESPACE}/{engine_name}
    /// the zitadel controller cant create the vault engine, it must be created before with a vault resource, the vault resource must have the same namespace as the zitadel resource, the zitadel controller has vault access to write to the mows-core-secrets-vrc engines
    pub engine_name: String,
    pub path: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClientDataTargetKubernetes {}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelApplicationMethod {
    Oidc(RawZitadelApplicationOidc),
    //Saml(RawZitadelApplicationSaml),
    Api(RawZitadelApplicationApi),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelApplicationOidc {
    pub redirect_uris: Vec<String>,
    pub response_types: Vec<OidcResponseType>,
    pub grant_types: Vec<OidcGrantType>,
    pub app_type: OidcAppType,
    pub authentication_method: OidcAuthMethodType,
    #[serde(default)]
    pub post_logout_redirect_uris: Vec<String>,
    pub dev_mode: bool,
    pub access_token_type: OidcTokenType,
    pub access_token_role_assertion: Option<bool>,
    pub id_token_role_assertion: Option<bool>,
    pub id_token_userinfo_assertion: Option<bool>,
    pub clock_skew: Option<Duration>,
    #[serde(default)]
    pub additional_origins: Vec<String>,
    pub skip_native_app_success_page: Option<bool>,
    pub back_channel_logout_uri: Option<String>,
    pub login_version: Option<LoginVersion>,
}
#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum LoginVersion {
    Version1,
    Version2,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum OidcResponseType {
    Code,
    IdToken,
    IdTokenToken,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum OidcGrantType {
    AuthorizationCode,
    Implicit,
    RefreshToken,
    DeviceCode,
    TokenExchange,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum OidcAppType {
    Web,
    UserAgent,
    Native,
}
#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum OidcAuthMethodType {
    Basic,
    Post,
    None,
    PrivateKeyJwt,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum OidcTokenType {
    Bearer,
    Jwt,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Duration {
    pub seconds: i64,
    pub nanos: i32,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelApplicationSaml {}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelApplicationApi {
    #[schemars(with = "String")]
    auth_method_type: ApiAuthMethodType,
}

pub fn oidc_response_type_to_zitadel(response_type: &OidcResponseType) -> i32 {
    match response_type {
        OidcResponseType::Code => 0,
        OidcResponseType::IdToken => 1,
        OidcResponseType::IdTokenToken => 2,
    }
}

pub fn oidc_grant_type_to_zitadel(grant_type: &OidcGrantType) -> i32 {
    match grant_type {
        OidcGrantType::AuthorizationCode => 0,
        OidcGrantType::Implicit => 1,
        OidcGrantType::RefreshToken => 2,
        OidcGrantType::DeviceCode => 3,
        OidcGrantType::TokenExchange => 4,
    }
}

pub fn oidc_app_type_to_zitadel(app_type: &OidcAppType) -> i32 {
    match app_type {
        OidcAppType::Web => 0,
        OidcAppType::UserAgent => 1,
        OidcAppType::Native => 2,
    }
}

pub fn oidc_auth_method_type_to_zitadel(auth_method_type: &OidcAuthMethodType) -> i32 {
    use zitadel::api::zitadel::app::v1::OidcGrantType;

    match auth_method_type {
        OidcAuthMethodType::Basic => 0,
        OidcAuthMethodType::Post => 1,
        OidcAuthMethodType::None => 2,
        OidcAuthMethodType::PrivateKeyJwt => 3,
    }
}

pub fn oidc_access_token_type_to_zitadel(access_token_type: &OidcTokenType) -> i32 {
    match access_token_type {
        OidcTokenType::Bearer => 0,
        OidcTokenType::Jwt => 1,
    }
}
