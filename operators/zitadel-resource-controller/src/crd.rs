use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use zitadel::api::zitadel::app::v1::{
    ApiAuthMethodType, LoginVersion, OidcAppType, OidcAuthMethodType, OidcGrantType, OidcResponseType,
    OidcTokenType, OidcVersion,
};

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
    pub roles: Vec<RawZitadelProjectRole>,
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
    pub name: String,
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
    #[schemars(with = "Vec<String>")]
    pub response_types: Vec<OidcResponseType>,
    #[schemars(with = "Vec<String>")]
    pub grant_types: Vec<OidcGrantType>,
    #[schemars(with = "String")]
    pub app_type: OidcAppType,
    #[schemars(with = "String")]
    pub auth_method_type: OidcAuthMethodType,
    pub post_logout_redirect_uris: Vec<String>,
    #[schemars(with = "String")]
    pub version: OidcVersion,
    pub dev_mode: bool,
    #[schemars(with = "String")]
    pub access_token_type: OidcTokenType,
    pub access_token_role_assertion: bool,
    pub id_token_role_assertion: bool,
    pub id_token_userinfo_assertion: bool,
    pub clock_skew: Option<Duration>,
    pub additional_origins: Vec<String>,
    pub skip_native_app_success_page: bool,
    pub back_channel_logout_uri: String,
    #[schemars(with = "Option<String>")]
    pub login_version: Option<LoginVersion>,
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
