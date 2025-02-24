use crate::{
    rendered_document::{
        CrdHandling, KubernetesResourceError, RenderedDocument, RenderedDocumentFilter,
    },
    types::MowsManifest,
    utils::{get_dynamic_kube_api, parse_manifest},
};
use anyhow::Context;
use fs_extra::dir::CopyOptions;
use k8s_openapi::api::core::v1::Namespace;
use kube::{
    api::{DynamicObject, GroupVersionKind, ObjectMeta, Patch, PatchParams},
    Api, Discovery, ResourceExt,
};
use mows_common::{kube::get_kube_client, utils::generate_id};
use raw::RawSpecError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tracing::{debug, trace};
use utoipa::ToSchema;
mod raw;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct Repository {
    pub uri: String,
}

impl Repository {
    pub fn new(uri: &str) -> Self {
        Self {
            uri: uri.to_string(),
        }
    }

    pub async fn render(
        &self,
        namespace: &str,
        root_working_directory: &str,
    ) -> Result<Vec<RenderedDocument>, RenderError> {
        let repo_paths = self.get_repository_paths(root_working_directory).await?;

        let _ = &self.fetch(&repo_paths.source_path).await?;

        let mows_manifest = self.get_manifest(&repo_paths.manifest_path).await?;

        let result = match mows_manifest.spec {
            crate::types::MowsSpec::Raw(raw_spec) => {
                raw_spec.render(&repo_paths, &namespace).await?
            }
        };

        Ok(result)
    }

    pub async fn get_repository_paths(
        &self,
        root_working_directory: &str,
    ) -> anyhow::Result<RepositoryPaths> {
        Ok(RepositoryPaths::new(root_working_directory).await)
    }

    pub async fn fetch(&self, target_path: &PathBuf) -> Result<(), FetchMowsRepoError> {
        if self.uri.starts_with("file://") {
            let cp_options = &CopyOptions::new().content_only(true).overwrite(true);

            fs_extra::dir::copy(&self.uri[7..], target_path, cp_options).context(format!(
                "Error copying files from {} to {}",
                &self.uri[7..],
                target_path.display()
            ))?;
        } else {
            return Err(FetchMowsRepoError::InvalidUri(self.uri.clone()));
        }
        Ok(())
    }

    pub async fn get_manifest(
        &self,
        manifest_path: &PathBuf,
    ) -> Result<MowsManifest, ManifestError> {
        let mows_manifest_string =
            tokio::fs::read_to_string(manifest_path)
                .await
                .context(format!(
                    "Error reading manifest file: {}",
                    manifest_path.display()
                ))?;

        let mows_manifest = parse_manifest(&mows_manifest_string).await?;

        Ok(mows_manifest)
    }

    pub async fn install(
        &self,
        requested_namespace: &str,
        root_working_directory: &str,
        crd_handling: &CrdHandling,
        kubeconfig: &str,
    ) -> Result<(), InstallError> {
        debug!("Installing repository: {:?}", self);

        let rendered_documents = self
            .render(requested_namespace, root_working_directory)
            .await
            .context(format!("Error rendering documents"))?;

        self.install_with_api(
            requested_namespace,
            kubeconfig,
            rendered_documents,
            crd_handling,
        )
        .await?;

        Ok(())
    }

    pub async fn install_with_api(
        &self,
        requested_namespace: &str,
        kubeconfig: &str,
        rendered_documents: Vec<RenderedDocument>,
        crd_handling: &CrdHandling,
    ) -> Result<(), InstallError> {
        debug!("Installing repository: {:?}", self);

        let rendered_documents = rendered_documents.filter_crd(crd_handling);

        let client = get_kube_client(kubeconfig)
            .await
            .context(format!("Error creating kube client"))?;

        let discovery = Discovery::new(client.clone())
            .run()
            .await
            .context("Error creating discovery client")?;

        let patch_params = PatchParams::apply("mows-package-manager").force();

        // create namespace if it doesn't exist
        if crd_handling != &CrdHandling::OnlyCrd {
            let ns_api: Api<Namespace> = Api::all(client.clone());

            let namespace = Namespace {
                metadata: ObjectMeta {
                    name: Some(requested_namespace.to_string()),
                    ..Default::default()
                },
                ..Default::default()
            };

            ns_api
                .patch(
                    requested_namespace,
                    &patch_params,
                    &Patch::Apply(&namespace),
                )
                .await
                .context(format!("Error creating namespace: {}", requested_namespace))?;
        }

        for rendered_document in rendered_documents {
            if rendered_document.resource.is_null() {
                continue;
            }
            let resource: DynamicObject =
                serde_yaml_ng::from_value(rendered_document.resource.clone())
                    .context("Error parsing resource as DynamicObject")?;

            let group_version_kind = match &resource.types {
                Some(type_meta) => GroupVersionKind::try_from(type_meta)
                    .context("Error converting type meta to GroupVersionKind")?,
                None => {
                    return Err(InstallError::AnyhowError(anyhow::anyhow!(
                        "No type meta found in object: {:?} \nPath: {}",
                        rendered_document.resource,
                        rendered_document.file_path,
                    )))
                }
            };

            // serde_yaml converts the mode 0404 to the string "0404", that does not work with the kubernetes API

            let is_namespace = group_version_kind.kind == "Namespace";

            let namespace_to_use = resource.namespace();
            let namespace_to_use = namespace_to_use.as_deref().or(Some(requested_namespace));

            let object_name = resource.name_any();

            match discovery.resolve_gvk(&group_version_kind) {
                Some((api_resource, api_capabilities)) => {
                    let api = get_dynamic_kube_api(
                        api_resource,
                        api_capabilities,
                        client.clone(),
                        namespace_to_use,
                        is_namespace,
                    );

                    let _response = api
                        .patch(
                            &object_name,
                            &patch_params,
                            &Patch::Apply(&rendered_document.resource),
                        )
                        .await
                        .context(format!(
                            "Error applying object: \n{}",
                            &serde_yaml_ng::to_string(&rendered_document.resource)?
                        ))?;
                }
                None => {
                    return Err(InstallError::AnyhowError(anyhow::anyhow!(
                        "API not found for Group Version Kind: {:?}",
                        group_version_kind
                    )))
                }
            };
        }

        Ok(())
    }
}

const MANIFEST_FILE_NAME: &str = "manifest.mows.yaml";

pub struct RepositoryPaths {
    /// The parent working directory
    pub package_manager_working_path: PathBuf,
    pub repository_working_path: PathBuf,
    pub source_path: PathBuf,
    pub manifest_path: PathBuf,
    pub output_path: PathBuf,
}

impl RepositoryPaths {
    pub async fn new(root_working_directory: &str) -> Self {
        let working_path = Path::new(root_working_directory).join(generate_id(50));
        let source_path = working_path.join("source");
        let manifest_path = source_path.join(MANIFEST_FILE_NAME);
        let output_path = working_path.join("output");

        let _ = tokio::fs::remove_dir_all(&working_path).await.map_err(|e| {
            trace!("Error removing working directory: {}", e);
        });

        tokio::fs::create_dir_all(&source_path).await.unwrap();
        tokio::fs::create_dir_all(&output_path).await.unwrap();

        Self {
            package_manager_working_path: PathBuf::from(root_working_directory),
            source_path,
            repository_working_path: working_path,
            manifest_path,
            output_path,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RenderError {
    #[error("Error fetching repository: {0}")]
    FetchError(#[from] FetchMowsRepoError),
    #[error("Manifest Error: {0}")]
    ManifestError(#[from] ManifestError),
    #[error("RawSpec Error: {0}")]
    RawSpecError(#[from] RawSpecError),
    #[error("IO error: {0}")]
    IoError(#[from] tokio::io::Error),
    #[error("Parsing Error: {0}")]
    ParseError(#[from] serde_yaml_ng::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("Parsing Error: {0}")]
    ParsingError(#[from] serde_yaml_ng::Error),
    #[error("IO error: {0}")]
    IoError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum FetchMowsRepoError {
    #[error("Invalid URI: {0}")]
    InvalidUri(String),
    #[error("IO error: {0}")]
    IoError(#[from] tokio::io::Error),
    #[error("FS Extra error: {0}")]
    FsExtraError(#[from] fs_extra::error::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum InstallError {
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
    #[error(transparent)]
    RepositoryError(#[from] RenderError),
    #[error(transparent)]
    KubeError(#[from] kube::Error),
    #[error(transparent)]
    SerdeYamlError(#[from] serde_yaml_ng::Error),
    #[error(transparent)]
    SerdeJsonError(#[from] serde_json::Error),
    #[error(transparent)]
    KubernetesResourceError(#[from] KubernetesResourceError),
}
