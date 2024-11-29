use std::collections::HashMap;

use helm::HelmRepoError;

use crate::{dev::get_cluster_variables, types::RawSpec, utils::get_all_file_paths_recursive};

use super::RepositoryPaths;

mod helm;

impl RawSpec {
    pub async fn render(&self, repo_paths: &RepositoryPaths) -> Result<(), RawSpecError> {
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

        Ok(())
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
                .fold(file_content, |acc, (key, value)| acc.replace(key, value));

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
}
