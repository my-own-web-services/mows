use std::collections::{BTreeMap, HashMap};

use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "VaultResource",
    group = "vault.k8s.mows.cloud",
    version = "v1",
    namespaced,
    doc = "Custom kubernetes resource for applying Vault resources like secret engines, auth engines, policies, and secret sync configurations."
)]
#[kube(status = "VaultResourceStatus", shortname = "vres")]
#[serde(rename_all = "camelCase")]
pub enum VaultResourceSpec {
    SecretEngine(VaultSecretEngine),
    AuthEngine(VaultAuthEngine),
    EngineAccessPolicy(VaultEngineAccessPolicy),
    SecretSync(VaultSecretSync),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretSync {
    pub kv_mapping: HashMap<String, SecretSyncKvMapping>,
    pub targets: VaultSecretSyncTargetTypes,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretSyncTargetTypes {
    // TODO: this should also allow for more options: like labels, annotations, etc.
    pub config_maps: Option<HashMap<String, VaultSecretSyncTargetConfigMap>>,
    pub secrets: Option<HashMap<String, VaultSecretSyncTargetSecret>>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretSyncTargetConfigMap {
    pub labels: Option<BTreeMap<String, String>>,
    pub annotations: Option<BTreeMap<String, String>>,
    pub data: BTreeMap<String, String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretSyncTargetSecret {
    #[serde(rename = "type")]
    pub secret_type: Option<String>,
    pub labels: Option<BTreeMap<String, String>>,
    pub annotations: Option<BTreeMap<String, String>>,
    pub data: BTreeMap<String, String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
pub enum SecretSyncTargetResource {
    ConfigMap,
    Secret,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SecretSyncKvMapping {
    pub engine: String,
    pub path: String,
}

/// Policies will be named mows-core-secrets-vrc/{namespace}/{policy_id}
#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultEngineAccessPolicy {
    pub sub_policies: Vec<VaultEngineAccessPolicySubPolicy>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultEngineAccessPolicySubPolicy {
    pub engine_id: String,
    pub engine_type: VaultEngineAccessPolicyType,
    pub sub_path: String,
    pub capabilities: Vec<VaultPolicyCapability>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum VaultEngineAccessPolicyType {
    Auth,
    Secret,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "camelCase")]
pub enum VaultPolicyCapability {
    Read,
    Create,
    Update,
    Delete,
    List,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum VaultAuthEngine {
    Kubernetes(KubernetesAuthEngineParams),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct KubernetesAuthEngineParams {
    pub roles: HashMap<String, KubernetesAuthEngineRole>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct KubernetesAuthEngineRole {
    pub service_account_name: String,
    pub namespace: Option<String>,
    /// The vault policy id to attach to the service account without namespace
    pub policy_ids: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
pub enum VaultSecretEngine {
    #[serde(rename = "kv-v2")]
    KV2(KV2SecretEngineParams),
    #[serde(rename = "transit")]
    Transit(TransitSecretEngineParams),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransitSecretEngineParams {}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct KV2SecretEngineParams {
    pub kv_data: HashMap<String, HashMap<String, String>>,
}

/// The status object of `VaultResource`
#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct VaultResourceStatus {
    pub created: bool,
}
