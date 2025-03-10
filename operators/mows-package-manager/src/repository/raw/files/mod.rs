use crate::{
    rendered_document::{RenderedDocument, RenderedDocumentDebug},
    repository_paths::RepositoryPaths,
    types::FilesSpec,
    utils::{
        get_all_file_paths_recursive, parse_resources_from_file_extension,
        replace_cluster_variables_in_folder_in_place,
    },
};
use anyhow::Context;
use std::collections::HashMap;

impl FilesSpec {
    pub async fn handle(
        &self,
        repo_paths: &RepositoryPaths,
        source_name: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, FilesSpecError> {
        let source_path = repo_paths
            .mows_repo_source_path
            .join("sources")
            .join(source_name);
        let file_paths = get_all_file_paths_recursive(&source_path).await;

        replace_cluster_variables_in_folder_in_place(&source_path, cluster_variables)
            .await
            .context(format!(
                "Failed to replace cluster variables in files for source: {}",
                source_name
            ))?;

        let mut rendered_documents: Vec<RenderedDocument> = vec![];

        for file_path in file_paths {
            let file_content = tokio::fs::read_to_string(&file_path).await?;

            let resources = parse_resources_from_file_extension(
                file_path
                    .extension()
                    .ok_or(FilesSpecError::AnyhowError(anyhow::anyhow!(
                        "Failed to get file extension"
                    )))?
                    .to_str()
                    .ok_or(FilesSpecError::AnyhowError(anyhow::anyhow!(
                        "Failed to convert file extension"
                    )))?,
                &file_content,
            )?;

            for resource in resources {
                let rendered_document = RenderedDocument {
                    resource,
                    source_name: source_name.to_string(),
                    source_type: crate::types::ManifestSource::Files(self.clone()),
                    debug: RenderedDocumentDebug {
                        resource_string_before_parse: Some(file_content.clone()),
                        resource_source_path: Some(file_path.to_string_lossy().to_string()),
                        ..Default::default()
                    },
                };

                rendered_documents.push(rendered_document);
            }
        }

        Ok(rendered_documents)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum FilesSpecError {
    #[error(transparent)]
    IoError(#[from] std::io::Error),
    #[error(transparent)]
    SerdeYamlError(#[from] serde_yaml_ng::Error),
    #[error(transparent)]
    SerdeJsonError(#[from] serde_json::Error),
    #[error(transparent)]
    TomlError(#[from] toml::de::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}
