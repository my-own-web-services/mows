use crate::{
    rendered_document::{RenderedDocument, RenderedDocumentDebug},
    repository::RepositoryPaths,
    types::{RemoteFile, RemoteFilesSpec},
    utils::{
        download_or_get_cached_file, parse_resources_from_file_extension,
        replace_cluster_variables_in_string, GetRemoteFileError,
    },
};
use std::collections::HashMap;

impl RemoteFilesSpec {
    pub async fn handle(
        &self,
        repo_paths: &RepositoryPaths,
        source_name: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, RemoteFilesSpecError> {
        let mut rendered_documents = Vec::new();

        for remote_file in &self.files {
            rendered_documents.extend(
                remote_file
                    .handle(repo_paths, self, source_name, cluster_variables)
                    .await?,
            );
        }

        Ok(rendered_documents)
    }
}

impl RemoteFile {
    pub async fn handle(
        &self,
        repo_paths: &RepositoryPaths,
        remote_files_spec: &RemoteFilesSpec,
        source_name: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, RemoteFilesSpecError> {
        let mut documents = vec![];

        let document_store_path = download_or_get_cached_file(
            &self.urls,
            &repo_paths.artifact_path,
            &self.sha256_digest,
            Some(10_000_000),
        )
        .await?;

        let document_string = tokio::fs::read_to_string(&document_store_path).await?;

        let document_string_cluster_variables_replaced =
            replace_cluster_variables_in_string(&document_string, cluster_variables).await?;

        let extension = match self._type.clone() {
            Some(t) => t,
            None => self.get_file_type()?,
        };

        let resources = parse_resources_from_file_extension(
            &extension,
            &document_string_cluster_variables_replaced,
        )?;

        for resource in resources {
            documents.push(RenderedDocument {
                source_name: source_name.to_string(),
                source_type: crate::types::ManifestSource::RemoteFiles(remote_files_spec.clone()),
                debug: RenderedDocumentDebug {
                    resource_source_path: Some(document_store_path.to_str().unwrap().to_string()),
                    resource_string_before_parse: Some(
                        document_string_cluster_variables_replaced.clone(),
                    ),
                    ..Default::default()
                },
                resource,
            });
        }
        Ok(documents)
    }

    fn get_file_type(&self) -> Result<String, RemoteFilesSpecError> {
        let mut last_extension = None;
        for url in &self.urls {
            let url_path = url.path();

            let url_extension = url_path.split('.').last();

            match url_extension {
                Some(current_extension) => match last_extension {
                    Some(ext) => {
                        if ext != current_extension {
                            return Err(RemoteFilesSpecError::Generic(anyhow::anyhow!(
                                "Multiple file extensions found in URLs"
                            )));
                        }
                    }
                    None => {
                        last_extension = url_extension;
                    }
                },
                None => {
                    return Err(RemoteFilesSpecError::Generic(anyhow::anyhow!(
                        "Failed to get file extension"
                    )));
                }
            }
        }
        Ok(last_extension
            .ok_or(RemoteFilesSpecError::Generic(anyhow::anyhow!(
                "Failed to get file extension"
            )))?
            .to_string())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RemoteFilesSpecError {
    #[error(transparent)]
    Generic(#[from] anyhow::Error),
    #[error(transparent)]
    IoError(#[from] std::io::Error),
    #[error(transparent)]
    SerdeJsonError(#[from] serde_json::Error),
    #[error(transparent)]
    SerdeYamlError(#[from] serde_yaml_neo::Error),
    #[error(transparent)]
    GetRemoteFileError(#[from] GetRemoteFileError),
}
