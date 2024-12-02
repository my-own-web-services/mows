use std::collections::HashMap;

use helm::HelmRepoError;
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
                    helm_repo.render(repo_paths).await?;
                }
            }
        }

        // read all files from output directory

        let mut result_files = HashMap::new();

        let file_paths = get_all_file_paths_recursive(&repo_paths.output_path).await;

        for file_path in file_paths {
            let file_content_string = tokio::fs::read_to_string(&file_path).await?;

            let mut value: Value = serde_yaml::from_str(&file_content_string)?;

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

            let file_content_string = serde_yaml::to_string(&value)?;

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
                file_content_string,
            );
        }

        Ok(result_files)
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
