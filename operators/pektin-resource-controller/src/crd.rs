use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::kube_fix::KubePektinDbEntry;

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "PektinResource",
    group = "pektin.k8s.mows.cloud",
    version = "v1",
    namespaced,
    doc = "Custom kubernetes resource for applying Pektin DNS entries."
)]
#[kube(status = "PektinResourceStatus", shortname = "pdns")]
#[serde(rename_all = "camelCase")]
pub enum PektinResourceSpec {
    Plain(Vec<KubePektinDbEntry>),
}

#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct PektinResourceStatus {
    pub created: bool,
}
