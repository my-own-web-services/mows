use serde::{Deserialize, Serialize};
use serde_yaml_ng::Value;
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct RenderedDocument {
    pub resource: Value,
    pub kind: String,
    pub file_path: String,
    pub index: usize,
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
