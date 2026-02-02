use crate::resource_types::RawZitadelResource;
use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

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
