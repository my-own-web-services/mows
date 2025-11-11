use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use url::Url;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ApiResponseStatus {
    Success,
    Error,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ApiResponse<T> {
    pub message: String,
    pub status: ApiResponseStatus,
    pub data: Option<T>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct EmptyApiResponse;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub manifest_version: String,
    pub metadata: ManifestMetadata,
    pub spec: ManifestSpec,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ManifestMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: String,
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum ManifestSpec {
    Raw(RawManifestSpec),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RawManifestSpec {
    pub sources: HashMap<String, ManifestSource>,
    pub transformations: Option<ManifestTransformations>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ManifestTransformations {
    pub patches: Vec<ManifestPatches>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ManifestPatches {
    pub target: Vec<PatchTargetFieldSelector>,
    /// RFC 6902
    pub patches: Option<Vec<JsonPatch>>,
    /// RFC 7396
    pub merge_patch: Option<Value>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct PatchTargetFieldSelector {
    pub field: String,
    pub regex: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum ManifestSource {
    Helm(HelmRepoSpec),
    Files(FilesSpec),
    RemoteFiles(RemoteFilesSpec),
}

impl std::fmt::Display for ManifestSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManifestSource::Helm(spec) => {
                writeln!(f, "Helm:")?;
                writeln!(f, "  releaseName: {}", spec.release_name)?;
                writeln!(f, "  chartName: {}", spec.chart_name)?;
                if let Some(urls) = &spec.urls {
                    writeln!(f, "  urls:")?;
                    for url in urls {
                        writeln!(f, "    - {}", url)?;
                    }
                }
                if let Some(version) = &spec.version {
                    writeln!(f, "  version: {}", version)?;
                }
                if let Some(digest) = &spec.sha256_digest {
                    writeln!(f, "  sha256Digest: {}", digest)?;
                }
                Ok(())
            }
            ManifestSource::Files(_) => write!(f, "Files"),
            ManifestSource::RemoteFiles(spec) => {
                writeln!(f, "RemoteFiles:")?;
                writeln!(f, "  files: {} file(s)", spec.files.len())?;
                Ok(())
            }
        }
    }
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct FilesSpec {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFilesSpec {
    pub files: Vec<RemoteFile>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFile {
    /// Multiple URLs are allowed for redundancy
    #[schema(value_type=Vec<String>)]
    #[schemars(with = "Vec<String>")]
    pub urls: Vec<Url>,
    pub sha256_digest: String,
    #[serde(rename = "type")]
    pub _type: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Digest {
    pub algorithm: DigestAlgorithm,
    pub value: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum DigestAlgorithm {
    Sha256,
    Sha512,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepoSpec {
    pub urls: Option<Vec<String>>,
    pub sha256_digest: Option<String>,
    pub version: Option<String>,
    pub release_name: String,
    pub chart_name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct JsonPatch {
    pub op: String,
    pub path: String,
    pub value: Value,
}
