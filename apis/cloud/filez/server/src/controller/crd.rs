use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::{apps::FilezApp, storage::config::StorageProviderConfig};

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "FilezResource",
    group = "filez.k8s.mows.cloud",
    version = "v1",
    namespaced
)]
#[kube(status = "FilezResourceStatus", shortname = "fr")]
#[serde(rename_all = "camelCase")]
pub enum FilezResourceSpec {
    StorageLocation(StorageProviderConfig),
    FilezApp(FilezApp),
}

#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct FilezResourceStatus {
    pub created: bool,
}
