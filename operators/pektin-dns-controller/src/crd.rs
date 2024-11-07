use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::kube_fix::KubePektinDbEntry;

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "PektinDns",
    group = "pektin.k8s.mows.cloud",
    version = "v1",
    namespaced
)]
#[kube(status = "PektinDnsStatus", shortname = "pdns")]
#[serde(rename_all = "camelCase")]
pub enum PektinDnsSpec {
    Plain(Vec<KubePektinDbEntry>),
}

/// The status object of `PektinDns`
#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct PektinDnsStatus {
    pub created: bool,
}
