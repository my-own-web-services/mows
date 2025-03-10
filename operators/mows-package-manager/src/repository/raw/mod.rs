use super::RepositoryPaths;
use crate::{
    rendered_document::RenderedDocument,
    types::{ManifestSource, RawManifestSpec},
};
use std::collections::HashMap;
use tracing::debug;
mod files;
mod helm;
mod remote_files;

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
            let returned_files = match source {
                ManifestSource::Helm(helm_repo) => helm_repo
                    .handle(repo_paths, namespace, source_name, cluster_variables)
                    .await
                    .map_err(|e| RawSpecSourcesError {
                        source_name: source_name.clone(),
                        source_type: "helm".to_string(),
                        source: RawSpecSourcesErrorVariant::HelmRepoError(e),
                    }),
                ManifestSource::Files(files) => files
                    .handle(repo_paths, source_name, cluster_variables)
                    .await
                    .map_err(|e| RawSpecSourcesError {
                        source_name: source_name.clone(),
                        source_type: "files".to_string(),
                        source: RawSpecSourcesErrorVariant::FilesError(e),
                    }),
                ManifestSource::RemoteFiles(remote_files_spec) => remote_files_spec
                    .handle(repo_paths, source_name, cluster_variables)
                    .await
                    .map_err(|e| RawSpecSourcesError {
                        source_name: source_name.clone(),
                        source_type: "remoteFiles".to_string(),
                        source: RawSpecSourcesErrorVariant::RemoteFilesError(e),
                    }),
            }?;

            rendered_documents.extend(returned_files);
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
#[error("Failed to handle {source_type} source named `{source_name}`")]
pub struct RawSpecSourcesError {
    pub source_name: String,
    pub source_type: String,
    pub source: RawSpecSourcesErrorVariant,
}

#[derive(Debug, thiserror::Error)]

pub enum RawSpecSourcesErrorVariant {
    #[error(transparent)]
    HelmRepoError(helm::HelmRepoError),
    #[error(transparent)]
    FilesError(files::FilesSpecError),
    #[error(transparent)]
    RemoteFilesError(remote_files::RemoteFilesSpecError),
}

#[derive(Debug, thiserror::Error)]
pub enum RawSpecError {
    #[error(transparent)]
    RemoteFilesError(#[from] RawSpecSourcesError),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}
