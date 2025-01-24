use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

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
    Plain(PlainZitadelResource),
}

/// The status object of `ZitadelResource`
#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct ZitadelResourceStatus {
    pub created: bool,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelResource {
    pub resource: PlainZitadelResourceSelector,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum PlainZitadelResourceSelector {
    Org(PlainZitadelOrg),
    Project(PlainZitadelProject),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelOrg {
    pub name: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelProject {
    pub name: String,
    pub applications: Vec<PlainZitadelApplication>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelApplication {
    pub name: String,
    pub project_id: String,
    pub app_method: PlainZitadelApplicationMethod,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum PlainZitadelApplicationMethod {
    Oidc(PlainZitadelApplicationOidc),
    Saml(PlainZitadelApplicationSaml),
    Api(PlainZitadelApplicationApi),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelApplicationOidc {
    pub redirect_uris: Vec<String>,
    pub app_type: PlainZitadelApplicationOidcAppType,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum PlainZitadelApplicationOidcAppType {
    Web,
    UserAgent,
    Native,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelApplicationSaml {}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PlainZitadelApplicationApi {}
