use crate::{
    repository::RepositoryPaths,
    types::{HelmRepoSpec, HelmRepoType, RemoteHelmRepo},
};
use flate2::read::GzDecoder;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, path::Path};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
};
use url::Url;
use utoipa::ToSchema;

impl HelmRepoSpec {
    pub async fn render(
        &self,
        repo_paths: &RepositoryPaths,
        unforced_namespace: &str,
    ) -> Result<(), HelmRepoError> {
        let chart_output_path = repo_paths.output_path.join("helm");
        let chart_path = repo_paths.source_path.join("charts").join(&self.chart_name);

        let mut args = vec![
            "template".to_string(),
            self.release_name.to_string(),
            chart_path
                .to_str()
                .ok_or_else(|| {
                    HelmRepoError::RenderHelmError(format!(
                        "Error rendering Helm: invalid chart path"
                    ))
                })?
                .to_string(),
            "--skip-tests".to_string(),
            "--include-crds".to_string(),
            "--output-dir".to_string(),
            chart_output_path
                .to_str()
                .ok_or_else(|| {
                    HelmRepoError::RenderHelmError(format!(
                        "Error rendering Helm: invalid output path"
                    ))
                })?
                .to_string(),
            "--namespace".to_string(),
            unforced_namespace.to_string(),
        ];

        if let Some(values_file_path_relative) = &self.values_file {
            let chart_values_path = repo_paths.source_path.join(values_file_path_relative);
            args.push("--values".to_string());
            args.push(
                chart_values_path
                    .to_str()
                    .ok_or_else(|| {
                        HelmRepoError::RenderHelmError(format!(
                            "Error rendering Helm: invalid values file path"
                        ))
                    })?
                    .to_string(),
            );
        };

        let command = Command::new("helm")
            .args(args)
            .output()
            .await
            .map_err(|e| HelmRepoError::RenderHelmError(format!("Error rendering Helm: {}", e)))?;

        if !command.status.success() {
            return Err(HelmRepoError::RenderHelmError(format!(
                "Error rendering Helm: {}",
                String::from_utf8_lossy(&command.stderr)
            )));
        }

        self.copy_additional_files(repo_paths).await?;

        Ok(())
    }

    pub async fn copy_additional_files(
        &self,
        repo_paths: &RepositoryPaths,
    ) -> Result<(), HelmRepoError> {
        if let Some(resources) = &self.resources {
            for file_path in resources.iter() {
                let file_path = Path::new(&file_path);
                let from = repo_paths.source_path.join(file_path);
                let to = repo_paths
                    .output_path
                    .join("helm")
                    .join(&self.chart_name)
                    .join("additional")
                    .join(file_path.file_name().ok_or_else(|| {
                        HelmRepoError::RenderHelmError(format!("Error copying file: invalid path"))
                    })?);

                // create parent directories if they don't exist
                tokio::fs::create_dir_all(to.parent().unwrap())
                    .await
                    .map_err(|e| {
                        HelmRepoError::RenderHelmError(format!("Error creating directory: {}", e))
                    })?;

                tokio::fs::copy(from, to).await.map_err(|e| {
                    HelmRepoError::RenderHelmError(format!("Error copying file: {}", e))
                })?;
            }
        }

        Ok(())
    }

    pub async fn get_chart(&self, repo_paths: &RepositoryPaths) -> Result<(), HelmRepoError> {
        match &self.repository {
            HelmRepoType::Remote(remote_repository) => {
                let helm_repository_index = self.fetch_remote_repository(remote_repository).await?;
                self.fetch_remote_chart(remote_repository, &helm_repository_index, repo_paths)
                    .await?;
            }
            HelmRepoType::Local => {
                // do nothing
            }
        }

        Ok(())
    }

    pub async fn fetch_remote_repository(
        &self,
        remote_repository: &RemoteHelmRepo,
    ) -> Result<HelmRepositoryIndex, HelmRepoError> {
        let req_path = format!("{}/index.yaml", remote_repository.url);

        let client = mows_common::reqwest::new_reqwest_client()
            .await
            .map_err(|e| {
                HelmRepoError::FetchHelmRepoError(format!("Error creating reqwest client: {}", e))
            })?;

        let response = client.get(&req_path).send().await.map_err(|e| {
            HelmRepoError::FetchHelmRepoError(format!("Error fetching HelmRepo: {}", e))
        })?;

        let helm_repository_index_string = response.text().await.map_err(|e| {
            HelmRepoError::FetchHelmRepoError(format!("Error fetching HelmRepo: {}", e))
        })?;

        let helm_repository_index: HelmRepositoryIndex =
            serde_yaml_ng::from_str(&helm_repository_index_string).map_err(|e| {
                HelmRepoError::FetchHelmRepoError(format!("Error parsing HelmRepo: {}", e))
            })?;

        Ok(helm_repository_index)
    }

    pub async fn fetch_remote_chart(
        &self,
        remote_repository: &RemoteHelmRepo,
        helm_repo_index: &HelmRepositoryIndex,
        repo_paths: &RepositoryPaths,
    ) -> Result<(), HelmRepoError> {
        let chart_versions = helm_repo_index
            .entries
            .get(&self.chart_name)
            .ok_or_else(|| {
                HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: {}",
                    self.chart_name
                ))
            })?
            .iter()
            .find(|entry| entry.digest == remote_repository.sha256_digest)
            .ok_or(HelmRepoError::FetchHelmChartError(format!(
                "Error fetching HelmChart: {}",
                self.chart_name
            )))?;

        let temp_file_path = repo_paths
            .package_manager_working_path
            .join(&remote_repository.sha256_digest);

        // download the chart if it doesn't exist or the digest doesn't match
        if !Path::new(&temp_file_path).exists() {
            let reqwest_client = mows_common::reqwest::new_reqwest_client()
                .await
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!(
                        "Error creating reqwest client: {}",
                        e
                    ))
                })?;

            let tar_file = tokio::fs::File::create(Path::new(&temp_file_path))
                .await
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error creating file: {}", e))
                })?;

            let mut writer = tokio::io::BufWriter::new(tar_file);

            let mut hasher = Sha256::new();

            let chart_url =
                Self::get_remote_chart_url(&remote_repository, &chart_versions.urls).await?;

            let mut byte_stream = reqwest_client
                .get(chart_url)
                .send()
                .await
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: {}", e))
                })?
                .bytes_stream();

            while let Some(chunk) = byte_stream.next().await {
                let chunk = chunk.map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: {}", e))
                })?;

                hasher.update(&chunk);

                writer.write_all(&chunk).await.map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: {}", e))
                })?;

                writer.flush().await.map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: {}", e))
                })?;
            }

            let hex_digest = format!("{:x}", hasher.finalize());

            if hex_digest != remote_repository.sha256_digest {
                tokio::fs::remove_file(Path::new(&temp_file_path))
                    .await
                    .map_err(|e| {
                        HelmRepoError::FetchHelmChartError(format!("Error removing file: {}", e))
                    })?;

                return Err(HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: digest mismatch"
                )));
            }
        } else {
            // check if the file has the correct digest

            let tar_file = tokio::fs::File::open(Path::new(&temp_file_path))
                .await
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error opening file: {}", e))
                })?;

            let mut hasher = Sha256::new();

            let mut reader = tokio::io::BufReader::new(tar_file);

            let mut buffer = [0; 1024];

            loop {
                let count = reader.read(&mut buffer).await.map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error reading file: {}", e))
                })?;

                if count == 0 {
                    break;
                }

                hasher.update(&buffer[..count]);
            }

            let hex_digest = format!("{:x}", hasher.finalize());

            if hex_digest != remote_repository.sha256_digest {
                tokio::fs::remove_file(Path::new(&temp_file_path))
                    .await
                    .map_err(|e| {
                        HelmRepoError::FetchHelmChartError(format!("Error removing file: {}", e))
                    })?;

                return Err(HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: present file digest mismatch"
                )));
            }
        }

        // extract the tempfile to the source directory into a subdirectory named after the chart

        let chart_target_directory = repo_paths.source_path.join("charts");

        let archive_file = std::fs::File::open(Path::new(&temp_file_path)).map_err(|e| {
            HelmRepoError::FetchHelmChartError(format!("Error opening file: {}", e))
        })?;

        let uncompressed_file = GzDecoder::new(archive_file);

        let mut archive = tar::Archive::new(uncompressed_file);

        archive.unpack(&chart_target_directory).map_err(|e| {
            HelmRepoError::FetchHelmChartError(format!("Error unpacking file: {}", e))
        })?;

        Ok(())
    }

    async fn get_remote_chart_url(
        remote_repository: &RemoteHelmRepo,
        urls: &Vec<String>,
    ) -> Result<Url, HelmRepoError> {
        let url = Url::parse(&urls[0]).unwrap_or(
            Url::parse(&remote_repository.url)
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error parsing URL: {}", e))
                })?
                .join(&urls[0])
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error joining URL: {}", e))
                })?,
        );

        Ok(url)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum HelmRepoError {
    #[error("Error fetching HelmRepo: {0}")]
    FetchHelmRepoError(String),
    #[error("Error fetching HelmChart: {0}")]
    FetchHelmChartError(String),
    #[error("Error rendering Helm: {0}")]
    RenderHelmError(String),
    #[error("Error copying file: {0}")]
    CopyFileError(String),
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepositoryIndex {
    pub api_version: String,
    pub entries: HashMap<String, Vec<HelmRepositoryIndexEntry>>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepositoryIndexEntry {
    pub api_version: String,
    pub app_version: Option<String>,
    pub created: Option<String>,
    pub description: Option<String>,
    pub digest: String,
    pub icon: Option<String>,
    pub kube_version: Option<String>,
    pub maintainers: Option<Vec<HelmRepositoryIndexMaintainer>>,
    pub name: String,
    #[serde(rename = "type")]
    pub _type: Option<String>,
    pub urls: Vec<String>,
    pub version: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepositoryIndexMaintainer {
    pub email: Option<String>,
    pub name: Option<String>,
    pub url: Option<String>,
}
