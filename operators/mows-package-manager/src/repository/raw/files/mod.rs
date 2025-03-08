use std::collections::HashMap;

use anyhow::Context;
use toml::Value;

use crate::{
    rendered_document::{RenderedDocument, RenderedDocumentDebug},
    repository::RepositoryPaths,
    types::FilesSpec,
    utils::{get_all_file_paths_recursive, replace_cluster_variables},
};

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

        replace_cluster_variables(&source_path, cluster_variables)
            .await
            .context(format!(
                "Failed to replace cluster variables in files for source: {}",
                source_name
            ))?;

        let mut rendered_documents: Vec<RenderedDocument> = vec![];

        for file_path in file_paths {
            let extension = file_path.extension().unwrap_or_default();
            if ["yaml", "yml", "json", "toml"]
                .iter()
                .any(|v| *v == extension)
            {
                let file_content = tokio::fs::read_to_string(&file_path).await?;

                let resource: serde_json::Value = if extension == "json" {
                    serde_json::from_str(&file_content)?
                } else if extension == "toml" {
                    let toml_resource: Value = toml::from_str(&file_content)?;

                    serde_json::from_value(serde_json::to_value(toml_resource)?)?
                } else {
                    let yaml_resource = serde_yaml_ng::from_str(&file_content)?;

                    serde_json::from_value(yaml_resource)?
                };

                let rendered_document = RenderedDocument {
                    resource,
                    source_name: source_name.to_string(),
                    source_type: crate::types::ManifestSource::Files(self.clone()),
                    debug: RenderedDocumentDebug {
                        resource_string_before_parse: Some(file_content),
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
    #[error("IO Error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("SerdeYaml Error: {0}")]
    SerdeError(#[from] serde_yaml_ng::Error),
    #[error("SerdeJson Error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),
    #[error("TOML Error: {0}")]
    TomlError(#[from] toml::de::Error),
    // generic error
    #[error("Error: {0}")]
    AnyhowError(#[from] anyhow::Error),
}
