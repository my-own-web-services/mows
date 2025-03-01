use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::types::ManifestSource;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct RenderedDocument {
    pub resource: serde_json::Value,
    pub kind: String,
    pub source_name: String,
    pub source_type: ManifestSource,
    pub debug: RenderedDocumentDebug,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct RenderedDocumentDebug {
    pub resource_string_before_parse: Option<String>,
    pub resource_source_path: Option<String>,
}

impl Default for RenderedDocumentDebug {
    fn default() -> Self {
        Self {
            resource_string_before_parse: None,
            resource_source_path: None,
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub enum CrdHandling {
    CrdFirst,
    WithoutCrd,
    OnlyCrd,
}

pub trait RenderedDocumentFilter {
    fn filter_crd(&self, crd_handling: &CrdHandling) -> Vec<RenderedDocument>;
}

impl RenderedDocumentFilter for Vec<RenderedDocument> {
    fn filter_crd(&self, crd_handling: &CrdHandling) -> Vec<RenderedDocument> {
        match crd_handling {
            CrdHandling::CrdFirst => {
                let (mut crds, mut non_crds): (Vec<_>, Vec<_>) = self
                    .iter()
                    .cloned()
                    .partition(|rd| rd.kind == "CustomResourceDefinition");
                crds.append(&mut non_crds);
                crds
            }
            CrdHandling::WithoutCrd => self
                .iter()
                .filter(|rd| rd.kind != "CustomResourceDefinition")
                .cloned()
                .collect(),
            CrdHandling::OnlyCrd => self
                .iter()
                .filter(|rd| rd.kind == "CustomResourceDefinition")
                .cloned()
                .collect(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum KubernetesResourceError {
    #[error("Error parsing KubernetesResource as DynamicObject: {0}")]
    SerdeError(#[from] serde_yaml_ng::Error),
}
