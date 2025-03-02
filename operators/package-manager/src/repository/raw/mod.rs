use super::RepositoryPaths;
use crate::{
    rendered_document::RenderedDocument,
    types::{ManifestSource, RawManifestSpec},
};
use helm::HelmRepoError;
use std::collections::HashMap;
use tracing::debug;
mod files;
mod helm;

impl RawManifestSpec {
    pub async fn handle(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, RawSpecError> {
        let mut rendered_documents = self
            .render(repo_paths, namespace, cluster_variables)
            .await?;
        self.transform(&mut rendered_documents).await?;

        Ok(rendered_documents)
    }

    pub async fn render(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, RawSpecError> {
        let mut rendered_documents: Vec<RenderedDocument> = Vec::new();

        for (source_name, source) in &self.sources {
            match source {
                ManifestSource::Helm(helm_repo) => {
                    let helm_rendered_documents = helm_repo
                        .handle(repo_paths, namespace, source_name, cluster_variables)
                        .await?;
                    // append all
                    rendered_documents.extend(helm_rendered_documents);
                }
                ManifestSource::Files(files) => {
                    let returned_files = files
                        .handle(repo_paths, source_name, cluster_variables)
                        .await?;
                    rendered_documents.extend(returned_files);
                }
            }
        }

        Ok(rendered_documents)
    }

    pub async fn transform(
        &self,
        rendered_documents: &mut Vec<RenderedDocument>,
    ) -> Result<(), RawSpecError> {
        debug!("Transforming rendered documents");
        if let Some(transformations) = &self.transformations {
            for rendered_document in rendered_documents {
                rendered_document.transform(transformations).await?;
            }
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RawSpecError {
    #[error("Error rendering HelmRepo: {0}")]
    HelmRepoError(#[from] HelmRepoError),
    #[error("Error handling file spec: {0}")]
    FilesError(#[from] files::FilesSpecError),
    #[error("Error reading file: {0}")]
    ReadFileError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
    #[error("Error parsing file: {0}")]
    ParsingError(#[from] serde_yaml_ng::Error),
}
