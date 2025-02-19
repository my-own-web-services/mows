use serde::{Deserialize, Serialize};
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

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MowsManifest {
    pub manifest_version: String,
    pub metadata: MowsMetadata,
    pub spec: MowsSpec,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MowsMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum MowsSpec {
    Raw(RawSpec),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum RawSpec {
    HelmRepos(Vec<HelmRepoSpec>),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepoSpec {
    pub chart_name: String,
    pub release_name: String,
    pub repository: HelmRepoType,
    pub values_file: Option<String>,
    pub resources: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum HelmRepoType {
    Local,
    Remote(RemoteHelmRepo),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RemoteHelmRepo {
    pub url: String,
    /// sha256 digest of the chart
    pub sha256_digest: String,
}
