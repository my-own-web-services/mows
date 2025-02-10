use crate::{
    db::models::Repository,
    types::{MowsManifest, RenderedDocument},
    utils::{get_dynamic_kube_api, parse_manifest},
};
use anyhow::Context;
use fs_extra::dir::CopyOptions;
use k8s_openapi::api::core::v1::Namespace;
use kube::{
    api::{DynamicObject, GroupVersionKind, ObjectMeta, Patch, PatchParams},
    Api, Discovery, ResourceExt,
};
use mows_common::kube::get_kube_client;
use raw::RawSpecError;
use std::path::{Path, PathBuf};
mod raw;

impl Repository {
    pub async fn render(
        &self,
        namespace: &str,
        root_working_directory: &str,
    ) -> Result<Vec<RenderedDocument>, RenderError> {
        let repo_paths = RepositoryPaths::new(self, root_working_directory).await;

        let _ = &self.fetch(&repo_paths.source_path).await?;

        let mows_manifest = self.get_manifest(&repo_paths.manifest_path).await?;

        let result = match mows_manifest.spec {
            crate::types::MowsSpec::Raw(raw_spec) => {
                raw_spec.render(&repo_paths, &namespace).await?
            }
        };

        Ok(result)
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
        kubeconfig: &str,
    ) -> Result<(), InstallError> {
        let rendered_documents = self
            .render(requested_namespace, root_working_directory)
            .await?;

        let client = get_kube_client(kubeconfig).await?;

        let discovery = Discovery::new(client.clone()).run().await?;

        let patch_params = PatchParams::apply("mows-package-manager").force();

        // create namespace if it doesn't exist

        let ns_api: Api<Namespace> = Api::all(client.clone());

        let namespace = Namespace {
            metadata: ObjectMeta {
                name: Some(requested_namespace.to_string()),
                ..Default::default()
            },
            ..Default::default()
        };

        let _ = ns_api
            .patch(requested_namespace, &patch_params, &Patch::Apply(namespace))
            .await;

        for rendered_document in rendered_documents {
            if rendered_document.object.is_null() {
                continue;
            }
            let object: DynamicObject = serde_yaml_ng::from_value(rendered_document.object.clone())
                .context(format!(
                    "Error parsing rendered file as DynamicObject: {}",
                    rendered_document.file_path
                ))?;

            let group_version_kind = match &object.types {
                Some(type_meta) => GroupVersionKind::try_from(type_meta)
                    .context("Error converting type meta to GroupVersionKind")?,
                None => {
                    return Err(InstallError::AnyhowError(anyhow::anyhow!(
                        "No type meta found in object: {:?}",
                        rendered_document.object
                    )))
                }
            };

            // serde_yaml converts the mode 0404 to the string "0404", that does not work with the kubernetes API

            let is_namespace = group_version_kind.kind == "Namespace";

            let namespace_to_use = object.namespace();
            let namespace_to_use = namespace_to_use.as_deref().or(Some(requested_namespace));

            let object_name = object.name_any();

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
                            &Patch::Apply(&rendered_document.object),
                        )
                        .await
                        .context(format!(
                            "Error applying object: \n {}",
                            &serde_yaml_ng::to_string(&rendered_document.object)?
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
    pub working_path: PathBuf,
    pub source_path: PathBuf,
    pub manifest_path: PathBuf,
    pub output_path: PathBuf,
}

impl RepositoryPaths {
    pub async fn new(repository: &Repository, root_working_directory: &str) -> Self {
        let working_path = Path::new(root_working_directory).join(repository.id.to_string());
        let source_path = working_path.join("source");
        let manifest_path = source_path.join(MANIFEST_FILE_NAME);
        let output_path = working_path.join("output");

        let _ = tokio::fs::remove_dir_all(&working_path).await.map_err(|e| {
            tracing::warn!("Error removing working directory: {}", e);
        });

        tokio::fs::create_dir_all(&source_path).await.unwrap();
        tokio::fs::create_dir_all(&output_path).await.unwrap();

        Self {
            source_path,
            working_path,
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
}
