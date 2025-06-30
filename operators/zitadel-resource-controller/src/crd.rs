use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "ZitadelResource",
    group = "zitadel.k8s.mows.cloud",
    version = "v1",
    namespaced,
    doc = "Custom kubernetes resource for applying Zitadel resources like projects, roles, applications, etc."
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
    Project(RawZitadelProject),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelProject {
    pub project_role_assertion: bool,
    pub project_role_check: bool,
    pub roles: Vec<RawZitadelProjectRole>,
    /// the roles to assign to the "zitadel-admin"
    pub admin_roles: Vec<String>,
    pub applications: Vec<RawZitadelApplication>,
    pub action_flow: Option<RawZitadelActionAndFlow>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelActionAndFlow {
    pub actions: HashMap<String, RawZitadelAction>,
    pub flow: RawZitadelActionFlow,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelAction {
    pub script: String,
    pub timeout_seconds: Option<i64>,
    pub allowed_to_fail: Option<bool>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelActionFlow {
    pub complement_token: Option<ComplementTokenFlow>,
    //pub external_authentication: Option<ExternalAuthenticationFlow>,
    //pub internal_authentication: Option<InternalAuthenticationFlow>,
    //pub complement_saml_response: Option<ComplementSAMLResponse>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelActionFlowEnum {
    ComplementToken = 2,
}

impl RawZitadelActionFlowEnum {
    pub fn to_string(&self) -> String {
        match self {
            RawZitadelActionFlowEnum::ComplementToken => "2".to_string(),
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelActionFlowComplementTokenEnum {
    PreUserinfoCreation,
    PreAccessTokenCreation,
}

impl RawZitadelActionFlowComplementTokenEnum {
    pub fn to_string(&self) -> String {
        match self {
            RawZitadelActionFlowComplementTokenEnum::PreUserinfoCreation => "4".to_string(),
            RawZitadelActionFlowComplementTokenEnum::PreAccessTokenCreation => "5".to_string(),
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ComplementTokenFlow {
    pub pre_userinfo_creation: Option<Vec<String>>,
    pub pre_access_token_creation: Option<Vec<String>>,
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
    /// the zitadel controller cant create the vault engine, it must be created before with a vault resource, the vault resource must have the same namespace as the zitadel resource
    pub secret_engine_name: String,
    pub secret_engine_sub_path: String,
    pub kubernetes_auth_engine_name: String,
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
    pub dev_mode: Option<bool>,
    pub access_token_type: OidcTokenType,
    pub access_token_role_assertion: Option<bool>,
    pub id_token_role_assertion: Option<bool>,
    pub id_token_userinfo_assertion: Option<bool>,
    pub clock_skew_seconds: Option<i64>,
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
pub struct RawZitadelApplicationSaml {}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum ApiAuthMethodType {
    Basic,
    PrivateKeyJwt,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawZitadelApplicationApi {
    #[schemars(with = "String")]
    pub authentication_method: ApiAuthMethodType,
}

pub fn api_auth_method_type_to_zitadel(auth_method_type: &ApiAuthMethodType) -> i32 {
    match auth_method_type {
        ApiAuthMethodType::Basic => 0,
        ApiAuthMethodType::PrivateKeyJwt => 1,
    }
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

pub fn duration_to_zitadel(seconds: i64) -> pbjson_types::Duration {
    pbjson_types::Duration { seconds, nanos: 0 }
}
