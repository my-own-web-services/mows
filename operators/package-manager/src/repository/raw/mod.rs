use std::collections::HashMap;

use anyhow::Context;
use helm::HelmRepoError;
use serde::Deserialize;
use serde_yaml::Value;

use crate::{dev::get_cluster_variables, types::RawSpec, utils::get_all_file_paths_recursive};

use super::RepositoryPaths;

mod helm;

impl RawSpec {
    pub async fn render(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
    ) -> Result<HashMap<String, String>, RawSpecError> {
        match self {
            RawSpec::HelmRepos(helm_repos) => {
                for helm_repo in helm_repos {
                    helm_repo.fetch(repo_paths).await?;
                }
            }
        }

        let cluster_variables = get_cluster_variables().await;

        self.replace_cluster_variables(repo_paths, cluster_variables)
            .await?;

        match self {
            RawSpec::HelmRepos(helm_repos) => {
                for helm_repo in helm_repos {
                    helm_repo.render(repo_paths, namespace).await?;
                }
            }
        }

        // read all files from output directory

        let mut result_files = HashMap::new();

        let file_paths = get_all_file_paths_recursive(&repo_paths.output_path).await;

        for file_path in file_paths {
            let input_file_string = tokio::fs::read_to_string(&file_path).await?;

            let mut output_file_docs = Vec::new();

            for single_document_deserializer in
                serde_yaml::Deserializer::from_str(&input_file_string)
            {
                let mut value: Value = Value::deserialize(single_document_deserializer).context(
                    format!("Error parsing file: {}", file_path.to_str().unwrap_or("")),
                )?;

                let force_namespace = false;

                Self::transform(&mut value, namespace, force_namespace);

                let single_document_content_string = serde_yaml::to_string(&value)?;

                output_file_docs.push(single_document_content_string);
            }

            let output_path_string = repo_paths
                .output_path
                .to_str()
                .ok_or("Invalid file path")
                .map_err(|e| RawSpecError::AnyhowError(anyhow::anyhow!(e)))?;

            result_files.insert(
                file_path
                    .to_str()
                    .ok_or("Invalid file path")
                    .map_err(|e| RawSpecError::AnyhowError(anyhow::anyhow!(e)))?
                    .to_string()
                    .replace(output_path_string, ""),
                output_file_docs.join("---\n"),
            );
        }

        Ok(result_files)
    }

    fn transform(value: &mut Value, namespace: &str, force_namespace: bool) {
        if !force_namespace {
            return;
        }

        // TODO when force_namespace is true, we also need to remove the resource kind namespace completely

        match value {
            Value::Mapping(ref mut map) => {
                match map.get_mut(&serde_yaml::Value::String("metadata".to_string())) {
                    Some(metadata) => {
                        if let Value::Mapping(ref mut metadata_map) = metadata {
                            metadata_map.insert(
                                serde_yaml::Value::String("namespace".to_string()),
                                serde_yaml::Value::String(namespace.to_string()),
                            );
                        }
                    }
                    None => {
                        let metadata = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());
                        map.insert(serde_yaml::Value::String("metadata".to_string()), metadata);

                        if let Value::Mapping(ref mut metadata_map) = map
                            .get_mut(&serde_yaml::Value::String("metadata".to_string()))
                            .unwrap()
                        {
                            metadata_map.insert(
                                serde_yaml::Value::String("namespace".to_string()),
                                serde_yaml::Value::String(namespace.to_string()),
                            );
                        }
                    }
                }
            }
            _ => {}
        }
    }

    pub async fn replace_cluster_variables(
        &self,
        repo_paths: &RepositoryPaths,
        cluster_variables: HashMap<String, String>,
    ) -> Result<(), RawSpecError> {
        // replace cluster variables in all files recursively
        let file_paths = get_all_file_paths_recursive(&repo_paths.source_path).await;

        for file_path in file_paths {
            let file_content = tokio::fs::read_to_string(&file_path).await?;

            let replaced_content = cluster_variables
                .iter()
                .fold(file_content, |acc, (key, value)| {
                    acc.replace(&format!("${}", key), value)
                });

            tokio::fs::write(&file_path, replaced_content).await?;
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RawSpecError {
    #[error("Error rendering HelmRepo: {0}")]
    HelmRepoError(#[from] HelmRepoError),
    #[error("Error reading file: {0}")]
    ReadFileError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
    #[error("Error parsing file: {0}")]
    ParsingError(#[from] serde_yaml::Error),
}
