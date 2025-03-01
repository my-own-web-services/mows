use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub manifest_version: String,
    pub metadata: ManifestMetadata,
    pub spec: ManifestSpec,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestSpec {
    pub _type: PackageType,
    pub namespaces: Vec<String>,
    pub sources: HashMap<String, ManifestSource>,
    pub transformations: Option<ManifestTransformations>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestTransformations {
    pub patches: Option<Vec<ManifestPatches>>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPatches {
    pub target: Vec<PatchTargetFieldSelector>,
    /// RFC 6902
    pub patches: Option<Vec<JsonPatch>>,
    /// RFC 7396
    pub merge_patch: Option<Value>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PatchTargetFieldSelector {
    pub field: String,
    pub regex: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ManifestSource {
    Helm(HelmRepoSpec),
    Files(FilesSpec),
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FilesSpec {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepoSpec {
    pub uris: Vec<String>,
    pub digest: String,
    pub version: String,
    pub release_name: String,
    pub chart_name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum PackageType {
    Core,
    Apis,
    Apps,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JsonPatch {
    pub op: String,
    pub path: String,
    pub value: Value,
}
