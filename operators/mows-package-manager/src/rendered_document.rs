use json_patch::{merge, Patch};
use jsonptr::Pointer;
use serde::{Deserialize, Serialize};
use tracing::debug;
use utoipa::ToSchema;

use crate::types::{ManifestSource, ManifestTransformations, PatchTargetFieldSelector};

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct RenderedDocument {
    pub resource: serde_json::Value,
    pub source_name: String,
    pub source_type: ManifestSource,
    pub debug: RenderedDocumentDebug,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct RenderedDocumentDebug {
    pub resource_string_before_parse: Option<String>,
    pub resource_source_path: Option<String>,
    pub method_specific: Option<MethodSpecificRenderedDocumentDebug>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub enum MethodSpecificRenderedDocumentDebug {
    Helm(MethodSpecificRenderedDocumentDebugHelm),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, PartialEq, Eq)]
pub struct MethodSpecificRenderedDocumentDebugHelm {
    pub original_template: String,
}

impl Default for RenderedDocumentDebug {
    fn default() -> Self {
        Self {
            resource_string_before_parse: None,
            resource_source_path: None,
            method_specific: None,
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
                let (mut crds, mut non_crds): (Vec<_>, Vec<_>) =
                    self.iter().cloned().partition(|rd| match rd.get_kind() {
                        Ok(kind) => kind == "CustomResourceDefinition",
                        Err(_) => false,
                    });
                crds.append(&mut non_crds);
                crds
            }
            CrdHandling::WithoutCrd => self
                .iter()
                .filter(|rd| match rd.get_kind() {
                    Ok(kind) => kind != "CustomResourceDefinition",
                    Err(_) => false,
                })
                .cloned()
                .collect(),
            CrdHandling::OnlyCrd => self
                .iter()
                .filter(|rd| match rd.get_kind() {
                    Ok(kind) => kind == "CustomResourceDefinition",
                    Err(_) => false,
                })
                .cloned()
                .collect(),
        }
    }
}

impl RenderedDocument {
    pub fn get_kind(&self) -> anyhow::Result<String> {
        Ok(self.resource["kind"]
            .as_str()
            .ok_or(anyhow::anyhow!("Resource kind not found"))?
            .to_string())
    }
    pub async fn is_patch_target(
        &self,
        target_selectors: &Vec<PatchTargetFieldSelector>,
    ) -> anyhow::Result<bool> {
        let mut is_target = vec![];

        for target_selector in target_selectors {
            let pointer = Pointer::parse(&target_selector.field)?;
            if let Ok(field_value) = pointer.resolve(&self.resource) {
                let regex = regex::Regex::new(&target_selector.regex)?;
                if regex.is_match(&field_value.to_string()) {
                    is_target.push(true);
                } else {
                    is_target.push(false);
                }
            } else {
                is_target.push(false);
            }
        }

        Ok(is_target.iter().all(|x| *x))
    }
    pub async fn transform(
        &mut self,
        transformations: &ManifestTransformations,
    ) -> anyhow::Result<()> {
        // TODO make this cluster variable template enabled

        for patch in &transformations.patches {
            if self.is_patch_target(&patch.target).await? {
                if let Some(merge_patch) = &patch.merge_patch {
                    merge(&mut self.resource, merge_patch);
                }
                if let Some(json_patches) = &patch.patches {
                    debug!("Applying patches: {:?}", json_patches);
                    let converted_json_patches: Patch =
                        serde_json::from_value(serde_json::to_value(json_patches)?)?;
                    json_patch::patch(&mut self.resource, &converted_json_patches)?;
                }
            }
        }
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum KubernetesResourceError {
    #[error("Error parsing KubernetesResource as DynamicObject: {0}")]
    SerdeError(#[from] serde_yaml_ng::Error),
}
