use crate::{
    dev::get_fake_cluster_config,
    error_formatter::{
        error_prefix, extract_line_number_from_error, find_field_in_yaml, format_yaml_highlighted,
        format_yaml_with_error_line, hint_prefix, label,
    },
    rendered_document::{
        CrdHandling, KubernetesResourceError, RenderedDocument, RenderedDocumentFilter,
    },
    repository_paths::RepositoryPaths,
    types::Manifest,
    utils::{get_dynamic_kube_api, parse_manifest},
};
use anyhow::Context;
use k8s_openapi::api::core::v1::Namespace;
use kube::{
    api::{DynamicObject, GroupVersionKind, ObjectMeta, Patch, PatchParams},
    Api, Discovery, ResourceExt,
};
use mows_common_rust::{kube::get_kube_client, utils::copy_directory_recursive};
use raw::RawSpecError;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
use tracing::debug;
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
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, RenderError> {
        let repo_paths = self.get_repository_paths(root_working_directory).await?;
        let _ = &self
            .fetch_mows_repository(&repo_paths.mows_repo_source_path)
            .await?;

        debug!("Fetched repository: {:?}", self);

        let mows_manifest = self.read_manifest(&repo_paths.manifest_path).await?;

        debug!("Read manifest: {:?}", mows_manifest);

        let result = match mows_manifest.spec {
            crate::types::ManifestSpec::Raw(raw_spec) => {
                raw_spec
                    .handle(&repo_paths, &namespace, cluster_variables)
                    .await?
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

    pub async fn fetch_mows_repository(
        &self,
        target_path: &PathBuf,
    ) -> Result<(), FetchMowsRepoError> {
        if self.uri.starts_with("file://") {
            let source_path = Path::new(&self.uri[7..]);

            copy_directory_recursive(source_path, target_path, 10_000)
                .await
                .context(format!(
                    "Error copying files from {} to {}",
                    &source_path.display(),
                    target_path.display()
                ))?;

            debug!(
                "Copied files from {} to {}",
                &self.uri[7..],
                target_path.display()
            );
        } else {
            return Err(FetchMowsRepoError::InvalidUri(self.uri.clone()));
        }
        Ok(())
    }

    pub async fn read_manifest(&self, manifest_path: &PathBuf) -> Result<Manifest, ManifestError> {
        let mows_manifest_string =
            tokio::fs::read_to_string(manifest_path)
                .await
                .context(format!(
                    "Error reading manifest file: {}",
                    manifest_path.display()
                ))?;

        let mows_manifest = parse_manifest(&mows_manifest_string)
            .await
            .context(format!(
                "Error parsing manifest file: {}",
                manifest_path.display()
            ))?;

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

        let cluster_variables = get_fake_cluster_config().await;

        let rendered_documents = self
            .render(
                requested_namespace,
                root_working_directory,
                &cluster_variables,
            )
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
                serde_json::from_value(rendered_document.resource.clone())
                    .map_err(|e| {
                        let error_msg = e.to_string();
                        let resource_yaml = serde_yaml_ng::to_string(&rendered_document.resource)
                            .unwrap_or_else(|_| format!("{:?}", rendered_document.resource));

                        // Try to extract line number from error and highlight it
                        let line_num = extract_line_number_from_error(&error_msg)
                            .or_else(|| find_field_in_yaml(&resource_yaml, &error_msg));

                        let highlighted_content = if let Some(line_num) = line_num {
                            format_yaml_with_error_line(&resource_yaml, line_num, &error_msg)
                        } else {
                            format_yaml_highlighted(&resource_yaml, true)
                        };

                        {
                            let path_info = if let Some(path) = &rendered_document.debug.resource_source_path {
                                format!("{} {}\n", label("Resource Path"), path)
                            } else {
                                String::new()
                            };

                            anyhow::anyhow!(
                                "\n{} Error parsing resource as DynamicObject\n\
\n\
{} {}\n\
{}{}\n{}\n\
{} {}\n\
\n\
Resource content:\n\
{}",
                                error_prefix(),
                                label("Source"),
                                rendered_document.source_name,
                                path_info,
                                label("Source Type"),
                                rendered_document.source_type,
                                label("Error"),
                                error_msg,
                                highlighted_content
                            )
                        }
                    })?;

            let group_version_kind = match &resource.types {
                Some(type_meta) => GroupVersionKind::try_from(type_meta)
                    .with_context(|| {
                        let resource_yaml = serde_yaml_ng::to_string(&rendered_document.resource)
                            .unwrap_or_else(|_| format!("{:?}", rendered_document.resource));
                        let highlighted_content = format_yaml_highlighted(&resource_yaml, true);

                        let path_info = if let Some(path) = &rendered_document.debug.resource_source_path {
                            format!("{} {}\n", label("Resource Path"), path)
                        } else {
                            String::new()
                        };

                        format!(
                            "\n{} Error converting type meta to GroupVersionKind\n\
\n\
{} {}\n\
{}{} {:?}\n\
\n\
Resource content:\n\
{}",
                            error_prefix(),
                            label("Source"),
                            rendered_document.source_name,
                            path_info,
                            label("Type meta"),
                            type_meta,
                            highlighted_content
                        )
                    })?,
                None => {
                    let resource_yaml = serde_yaml_ng::to_string(&rendered_document.resource)
                        .unwrap_or_else(|_| format!("{:?}", rendered_document.resource));
                    let highlighted_content = format_yaml_highlighted(&resource_yaml, true);

                    let path_info = if let Some(path) = &rendered_document.debug.resource_source_path {
                        format!("{} {}\n", label("Resource Path"), path)
                    } else {
                        String::new()
                    };

                    return Err(InstallError::AnyhowError(anyhow::anyhow!(
                        "\n{} No type meta (apiVersion/kind) found in resource\n\
\n\
{} {}\n\
{}{}\n{}\n\
\n\
Resource content:\n\
{}\n\
\n\
{} Make sure your resource has 'apiVersion' and 'kind' fields defined.",
                        error_prefix(),
                        label("Source"),
                        rendered_document.source_name,
                        path_info,
                        label("Source Type"),
                        rendered_document.source_type,
                        highlighted_content,
                        hint_prefix()
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
                        .map_err(|e| {
                            let kube_error = e.to_string();
                            let resource_yaml = serde_yaml_ng::to_string(&rendered_document.resource)
                                .unwrap_or_else(|_| format!("{:?}", rendered_document.resource));

                            // Try to extract line number from Kubernetes validation error
                            let line_num = extract_line_number_from_error(&kube_error)
                                .or_else(|| find_field_in_yaml(&resource_yaml, &kube_error));

                            let highlighted_content = if let Some(line_num) = line_num {
                                format_yaml_with_error_line(&resource_yaml, line_num, &kube_error)
                            } else {
                                format_yaml_highlighted(&resource_yaml, true)
                            };

                            let path_info = if let Some(path) = &rendered_document.debug.resource_source_path {
                                format!("{} {}\n", label("Resource Path"), path)
                            } else {
                                String::new()
                            };

                            anyhow::anyhow!(
                                "\n{} Error applying resource '{}' of kind '{}'\n\
\n\
{} {}\n\
{}{} {}\n\
{} Kubernetes error:\n\
{}\n\
\n\
Resource content:\n\
{}",
                                error_prefix(),
                                object_name,
                                group_version_kind.kind,
                                label("Source"),
                                rendered_document.source_name,
                                path_info,
                                label("Namespace"),
                                namespace_to_use.unwrap_or("<cluster-scoped>"),
                                label(""),
                                kube_error,
                                highlighted_content
                            )
                        })?;
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

#[derive(Debug, thiserror::Error)]
pub enum RenderError {
    #[error("Failed to fetch repository")]
    FetchError(#[from] FetchMowsRepoError),
    #[error(transparent)]
    ManifestError(#[from] ManifestError),
    #[error(transparent)]
    RawSpecError(#[from] RawSpecError),
    #[error(transparent)]
    IoError(#[from] tokio::io::Error),
    #[error(transparent)]
    ParseError(#[from] serde_yaml_ng::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("Failed to parse manifest")]
    ParsingError(#[from] serde_yaml_ng::Error),
    #[error("Failed to read manifest")]
    IoError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum FetchMowsRepoError {
    #[error("Invalid URI: {0}, currently only file:// is supported")]
    InvalidUri(String),
    #[error(transparent)]
    IoError(#[from] tokio::io::Error),
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
