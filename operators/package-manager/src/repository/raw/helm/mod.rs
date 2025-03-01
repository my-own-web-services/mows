use crate::{
    rendered_document::{RenderedDocument, RenderedDocumentDebug},
    repository::RepositoryPaths,
    types::{HelmRepoSpec, ManifestSource},
};
use flate2::read::GzDecoder;
use futures::StreamExt;
use k8s_openapi::api::resource;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, path::Path};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
};
use tracing::{debug};
use url::Url;
use utoipa::ToSchema;

impl HelmRepoSpec {
    pub async fn handle(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
        source_name: &str,
    ) -> Result<Vec<RenderedDocument>, HelmRepoError> {
        self.get_chart(repo_paths,source_name).await?;
        self.render(repo_paths, &source_name, namespace).await
    }
    pub async fn render(
        &self,
        repo_paths: &RepositoryPaths,
        source_name: &str,
        unforced_namespace: &str,
    ) -> Result<Vec<RenderedDocument>, HelmRepoError> {
        let source_path = repo_paths
            .mows_repo_source_path
            .join("sources")
            .join(source_name);
        let chart_path = source_path.join(&self.chart_name);

        let values_path = source_path.join("values.yaml");
        let values_path = values_path.to_str().ok_or_else(|| {
            HelmRepoError::RenderHelmError(format!(
                "Error rendering Helm: invalid values file path"
            ))
        })?;

        let args = vec![
            "template",
            &self.release_name,
            chart_path.to_str().ok_or_else(|| {
                HelmRepoError::RenderHelmError(format!("Error rendering Helm: invalid chart path"))
            })?,
            "--skip-tests",
            "--include-crds",
            "--namespace",
            unforced_namespace,
            "--values",
            values_path,
        ];

        let command = Command::new("helm")
            .args(args)
            .output()
            .await
            .map_err(|e| HelmRepoError::RenderHelmError(format!("Error rendering Helm: {}", e)))?;

        if command.status.success() {
            let output = String::from_utf8_lossy(&command.stdout);

            let mut result_documents: Vec<RenderedDocument> = Vec::new();

            for document in output.split("---\n") {
                // get the resource path from the only comment in the document

                    let resource_source_path= document.lines().find(|line| line.starts_with("# Source:"))
                    .map(|line| line.trim_start_matches("# Source:").trim().to_string()).map(
                        |source_path| chart_path.join(source_path).to_str().unwrap().to_string()
                    );


                let resource: serde_yaml_ng::Value = serde_yaml_ng::from_str(document).map_err(|e| {
                    HelmRepoError::RenderHelmError(format!("Error rendering Helm: {}", e))
                })?;

                if resource.is_null() {
                    continue;
                }

                let resource: serde_json::Value=serde_json::to_value(&resource).map_err(|e| {
                    HelmRepoError::RenderHelmError(format!("Error rendering Helm: {}", e))
                })?;


                result_documents.push(RenderedDocument {
                    kind: resource["kind"].as_str().unwrap_or("").to_string(),
                    resource,
                    source_name: source_name.to_string(),
                    source_type: ManifestSource::Helm(self.clone()),
                    debug: RenderedDocumentDebug {
                        resource_string_before_parse: Some(document.to_string()),
                        resource_source_path
                    },
                });
            }

            Ok(result_documents)
        } else {
            return Err(HelmRepoError::RenderHelmError(format!(
                "Error rendering Helm: {}",
                String::from_utf8_lossy(&command.stderr)
            )));
        }
    }

    pub async fn get_chart(&self, repo_paths: &RepositoryPaths,source_name: &str) -> Result<(), HelmRepoError> {
        
        match &self.uris {
            Some(uris) => {
      
            let mut helm_repository_index_and_url: Option<(HelmRepositoryIndex, String)> = None;

            for remote_repository_uri in uris {
                match self
                    .fetch_remote_repository_index(remote_repository_uri)
                    .await
                {
                    Ok(index) => {
                        helm_repository_index_and_url =
                            Some((index, remote_repository_uri.to_string()));
                        break;
                    }
                    Err(_) => {
                        continue;
                    }
                }
            }

            self.fetch_remote_chart(
                repo_paths,
                &helm_repository_index_and_url.ok_or(HelmRepoError::FetchHelmChartError(
                    format!("Error fetching HelmChart: {}", self.chart_name),
                ))?,
                source_name
            )
            .await
            
            },
            None => {
                // local chart,  check if the folder exists
                let source_path = repo_paths
                    .mows_repo_source_path
                    .join("sources")
                    .join(source_name);
                let chart_path = source_path.join(&self.chart_name);

                match Path::new(&chart_path).exists() {
                    true => Ok(()),
                    false => {
                        return Err(HelmRepoError::FetchHelmChartError(format!(
                            "Error fetching HelmChart: local chart: {} not found at {}",
                            self.chart_name,
                            chart_path.to_str().unwrap()
                        )));
                    },
                }
            }
        }
    }

    pub async fn fetch_remote_repository_index(
        &self,
        uri: &str,
    ) -> Result<HelmRepositoryIndex, HelmRepoError> {
        let req_url = Url::parse(uri)
            .map_err(|e| HelmRepoError::FetchHelmRepoError(format!("Error parsing URL: {}", e)))?;

        // add index.yaml to the end of the URL if it doesn't exist

        let req_url = if req_url.path().ends_with("index.yaml") {
            req_url
        } else {
            req_url.join("index.yaml").map_err(|e| {
                HelmRepoError::FetchHelmRepoError(format!("Error joining URL: {}", e))
            })?
        };

        debug!(
            "Fetching Helm Repository Index from: {:?}",
            req_url.to_string()
        );

        let client = mows_common::reqwest::new_reqwest_client()
            .await
            .map_err(|e| {
                HelmRepoError::FetchHelmRepoError(format!("Error creating reqwest client: {}", e))
            })?;

        let response = client.get(req_url).send().await.map_err(|e| {
            HelmRepoError::FetchHelmRepoError(format!("Error fetching HelmRepo: {}", e))
        })?;

        let helm_repository_index_string = response.text().await.map_err(|e| {
            HelmRepoError::FetchHelmRepoError(format!("Error fetching HelmRepo: {}", e))
        })?;

        let helm_repository_index: HelmRepositoryIndex =
            serde_yaml_ng::from_str(&helm_repository_index_string).map_err(|e| {
                HelmRepoError::FetchHelmRepoError(format!("Error parsing HelmRepo: {}", e))
            })?;

        debug!("Fetched Helm Repository Index");

        Ok(helm_repository_index)
    }

    pub async fn fetch_remote_chart(
        &self,
        repository_paths: &RepositoryPaths,
        helm_repository_index_and_url: &(HelmRepositoryIndex, String),
        source_name: &str
    ) -> Result<(), HelmRepoError> {
        let helm_repo_index = &helm_repository_index_and_url.0;
        let chart_index_root_url = &helm_repository_index_and_url.1;

        let chart_index_url=Url::parse(chart_index_root_url).map_err(
            |e| HelmRepoError::FetchHelmChartError(format!("Error parsing URL: {}", e)
        ))?.join("index.yaml").map_err(
            |e| HelmRepoError::FetchHelmChartError(format!("Error joining URL: {}", e)
        ))?;

        let manifest_declared_digest = self.sha256_digest.clone().ok_or(
            HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: missing digest"))
        )?;

        let manifest_declared_version = self.version.clone().ok_or(
            HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: missing version"))
        )?;


        
        let chart_versions = helm_repo_index
            .entries
            .get(&self.chart_name)
            .ok_or_else(|| {
                
                HelmRepoError::FetchHelmChartError(format!(
                    "Could not find HelmChart with name: {} in the fetched Helm repository index from: {}",
                    self.chart_name,
                    chart_index_url
                ))
            })?
            .iter()
            .find(|entry| entry.digest == manifest_declared_digest)
            .ok_or(HelmRepoError::FetchHelmChartError(format!(
                "Could not find HelmChart with digest: {}",
                self.chart_name
            )))?;

        // check if the version matches
        if chart_versions.version != manifest_declared_version {
            return Err(HelmRepoError::FetchHelmChartError(format!(
                "Version mismatch with the digest. Digest matching version: {}, Manifest declared version: {}",
                chart_versions.version,
                manifest_declared_version
            )));
        }

        let temp_file_path_root = repository_paths
            .package_manager_working_path
            .join("helm");

        tokio::fs::create_dir_all(&temp_file_path_root) .await.map_err(|e| {
            HelmRepoError::FetchHelmChartError(format!("Error creating directory: {}", e))
        })?;

        let temp_file_path = temp_file_path_root
            .join(format!("{}.tar",&manifest_declared_digest));


        if Path::new(&temp_file_path).exists() {
            debug!(
                "HelmChart already present at {}, skipping download.",
                &temp_file_path.to_str().unwrap()
            );

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

            if hex_digest != manifest_declared_digest {
                tokio::fs::remove_file(Path::new(&temp_file_path))
                    .await
                    .map_err(|e| {
                        HelmRepoError::FetchHelmChartError(format!("Error removing file: {}", e))
                    })?;

                return Err(HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: present file digest mismatch"
                )));
            }
        } else {
            let chart_url = Self::get_remote_chart_url(&chart_index_root_url, &chart_versions.urls).await?;

            debug!(
                "Downloading HelmChart from: {:?}",
                chart_url
            );

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

            if hex_digest != manifest_declared_digest {
                tokio::fs::remove_file(Path::new(&temp_file_path))
                    .await
                    .map_err(|e| {
                        HelmRepoError::FetchHelmChartError(format!("Error removing file: {}", e))
                    })?;

                return Err(HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: digest mismatch"
                )));
            }
            
        }

        // extract the tempfile to the source directory into a subdirectory named after the chart

        let chart_target_directory = repository_paths.mows_repo_source_path.join("sources").join(source_name);

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
        repository_index_url: &str,
        chart_urls: &Vec<String>,
    ) -> Result<Url, HelmRepoError> {
        let url = Url::parse(&chart_urls[0]).unwrap_or(
            Url::parse(&repository_index_url)
                .map_err(|e| {
                    HelmRepoError::FetchHelmChartError(format!("Error parsing URL: {}", e))
                })?
                .join(&chart_urls[0])
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

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepositoryIndex {
    pub api_version: String,
    pub entries: HashMap<String, Vec<HelmRepositoryIndexEntry>>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
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

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HelmRepositoryIndexMaintainer {
    pub email: Option<String>,
    pub name: Option<String>,
    pub url: Option<String>,
}
