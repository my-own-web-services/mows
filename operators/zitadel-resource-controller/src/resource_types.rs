use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelActionFlowEnum {
    ComplementToken = 2,
}

impl RawZitadelActionFlowEnum {
    pub fn as_zitadel_id(&self) -> &'static str {
        match self {
            RawZitadelActionFlowEnum::ComplementToken => "2",
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
    pub fn as_zitadel_id(&self) -> &'static str {
        match self {
            RawZitadelActionFlowComplementTokenEnum::PreUserinfoCreation => "4",
            RawZitadelActionFlowComplementTokenEnum::PreAccessTokenCreation => "5",
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
    File(ClientDataTargetFile),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClientDataTargetVault {
    /// The name of the vault engine in the same namespace mows-core-secrets-vrc/{RESOURCE_SCOPE}/{engine_name}
    /// the zitadel controller cant create the vault engine, it must be created before with a vault resource, the vault resource must have the same scope as the zitadel resource
    pub secret_engine_name: String,
    pub secret_engine_sub_path: String,
    pub kubernetes_auth_engine_name: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClientDataTargetFile {
    /// The file path where the credentials JSON file will be written
    pub path: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum RawZitadelApplicationMethod {
    Oidc(RawZitadelApplicationOidc),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_auth_method_type_to_zitadel() {
        assert_eq!(api_auth_method_type_to_zitadel(&ApiAuthMethodType::Basic), 0);
        assert_eq!(
            api_auth_method_type_to_zitadel(&ApiAuthMethodType::PrivateKeyJwt),
            1
        );
    }

    #[test]
    fn test_oidc_response_type_to_zitadel() {
        assert_eq!(oidc_response_type_to_zitadel(&OidcResponseType::Code), 0);
        assert_eq!(oidc_response_type_to_zitadel(&OidcResponseType::IdToken), 1);
        assert_eq!(
            oidc_response_type_to_zitadel(&OidcResponseType::IdTokenToken),
            2
        );
    }

    #[test]
    fn test_oidc_grant_type_to_zitadel() {
        assert_eq!(
            oidc_grant_type_to_zitadel(&OidcGrantType::AuthorizationCode),
            0
        );
        assert_eq!(oidc_grant_type_to_zitadel(&OidcGrantType::Implicit), 1);
        assert_eq!(oidc_grant_type_to_zitadel(&OidcGrantType::RefreshToken), 2);
        assert_eq!(oidc_grant_type_to_zitadel(&OidcGrantType::DeviceCode), 3);
        assert_eq!(
            oidc_grant_type_to_zitadel(&OidcGrantType::TokenExchange),
            4
        );
    }

    #[test]
    fn test_oidc_app_type_to_zitadel() {
        assert_eq!(oidc_app_type_to_zitadel(&OidcAppType::Web), 0);
        assert_eq!(oidc_app_type_to_zitadel(&OidcAppType::UserAgent), 1);
        assert_eq!(oidc_app_type_to_zitadel(&OidcAppType::Native), 2);
    }

    #[test]
    fn test_oidc_auth_method_type_to_zitadel() {
        assert_eq!(
            oidc_auth_method_type_to_zitadel(&OidcAuthMethodType::Basic),
            0
        );
        assert_eq!(
            oidc_auth_method_type_to_zitadel(&OidcAuthMethodType::Post),
            1
        );
        assert_eq!(
            oidc_auth_method_type_to_zitadel(&OidcAuthMethodType::None),
            2
        );
        assert_eq!(
            oidc_auth_method_type_to_zitadel(&OidcAuthMethodType::PrivateKeyJwt),
            3
        );
    }

    #[test]
    fn test_oidc_access_token_type_to_zitadel() {
        assert_eq!(
            oidc_access_token_type_to_zitadel(&OidcTokenType::Bearer),
            0
        );
        assert_eq!(oidc_access_token_type_to_zitadel(&OidcTokenType::Jwt), 1);
    }

    #[test]
    fn test_duration_to_zitadel() {
        let d = duration_to_zitadel(30);
        assert_eq!(d.seconds, 30);
        assert_eq!(d.nanos, 0);
    }

    #[test]
    fn test_duration_to_zitadel_zero() {
        let d = duration_to_zitadel(0);
        assert_eq!(d.seconds, 0);
        assert_eq!(d.nanos, 0);
    }

    #[test]
    fn test_duration_to_zitadel_negative() {
        let d = duration_to_zitadel(-10);
        assert_eq!(d.seconds, -10);
        assert_eq!(d.nanos, 0);
    }

    #[test]
    fn test_action_flow_enum_as_zitadel_id() {
        assert_eq!(
            RawZitadelActionFlowEnum::ComplementToken.as_zitadel_id(),
            "2"
        );
    }

    #[test]
    fn test_complement_token_enum_as_zitadel_id() {
        assert_eq!(
            RawZitadelActionFlowComplementTokenEnum::PreUserinfoCreation.as_zitadel_id(),
            "4"
        );
        assert_eq!(
            RawZitadelActionFlowComplementTokenEnum::PreAccessTokenCreation.as_zitadel_id(),
            "5"
        );
    }
}
