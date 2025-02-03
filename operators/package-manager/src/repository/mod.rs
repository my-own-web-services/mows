use crate::{db::models::Repository, types::MowsManifest, utils::parse_manifest};
use anyhow::Context;
use fs_extra::dir::CopyOptions;
use mows_common::kube::get_kube_client;
use raw::RawSpecError;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
mod raw;

impl Repository {
    pub async fn render(
        &self,
        namespace: &str,
        root_working_directory: &str,
    ) -> Result<HashMap<String, String>, RenderError> {
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
        namespace: &str,
        root_working_directory: &str,
        kubeconfig: &str,
    ) -> Result<(), InstallError> {
        let rendered_files = self.render(namespace, root_working_directory).await?;
        let client = get_kube_client(kubeconfig).await?;
        // https://github.com/kube-rs/kube/blob/main/examples/kubectl.rs
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
    ParseError(#[from] serde_yaml::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("Parsing Error: {0}")]
    ParsingError(#[from] serde_yaml::Error),
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
}
