use crate::{
    rendered_document::{
        MethodSpecificRenderedDocumentDebug, MethodSpecificRenderedDocumentDebugHelm,
        RenderedDocument, RenderedDocumentDebug,
    },
    repository::RepositoryPaths,
    types::{HelmRepoSpec, ManifestSource},
    utils::{download_or_get_cached_file, replace_cluster_variables_in_folder_in_place},
};
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};
use tokio::process::Command;
use tracing::debug;
use url::Url;
use utoipa::ToSchema;

impl HelmRepoSpec {
    pub async fn handle(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
        source_name: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<Vec<RenderedDocument>, HelmRepoError> {
        self.get_chart(repo_paths, source_name, cluster_variables)
            .await?;
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

            // write output to file

            // tokio::fs::write(
            //     repo_paths.temp_path.join("helm_output.yaml"),
            //     output.as_ref(),
            // )
            // .await
            // .map_err(|e| {
            //     HelmRepoError::RenderHelmError(format!("Error writing helm output to file: {}", e))
            // })?;

            let mut result_documents: Vec<RenderedDocument> = Vec::new();

            // Parse the Helm output to extract source paths and YAML documents
            // Helm output format: ---\n# Source: path/to/file.yaml\n<yaml content>
            let mut raw_documents: Vec<String> = output
                .split("\n---\n# Source:")
                .map(|s| s.to_string())
                .collect();

            // remove the first empty string (before first ---)
            raw_documents.remove(0);

            // Extract paths and clean YAML content for each document
            let mut documents_with_paths: Vec<(String, String)> = Vec::new();

            for doc in raw_documents {
                let mut lines = doc.lines();
                let source_path_comment = lines.next().unwrap_or("");
                let source_path = source_path_comment.split(": ").last().unwrap_or("");
                // Remove first character which is a space
                let source_path = if !source_path.is_empty() && source_path.len() > 1 {
                    &source_path[1..]
                } else {
                    source_path
                };

                // Reconstruct the YAML content without the source comment
                let yaml_content = lines.collect::<Vec<_>>().join("\n");

                documents_with_paths.push((source_path.to_string(), yaml_content));
            }

            for (source_path, yaml_content) in documents_with_paths.iter()
            {
                let resource = serde_yaml_neo::from_str::<serde_yaml_neo::Value>(yaml_content)
                    .map_err(|e| {
                        HelmRepoError::RenderHelmError(format!(
                            "Error parsing YAML document from {}: {}",
                            source_path, e
                        ))
                    })?;

                if resource.is_null() {
                    continue;
                }

                let resource: serde_json::Value = serde_json::to_value(&resource).map_err(|e| {
                    HelmRepoError::RenderHelmError(format!("Error converting yaml to json: {}", e))
                })?;

                let method_specific: Option<MethodSpecificRenderedDocumentDebug> = {
                    // for some reason there is a very very strange bug that get triggered when using tokio::fs::read_to_string here see at the bottom of the file (*1)

                    let template_path = repo_paths
                        .mows_repo_source_path
                        .join("sources")
                        .join(source_name)
                        .join(source_path);
                    let original_template = std::fs::read_to_string(&template_path)
                        .map_err(|e| {
                            HelmRepoError::RenderHelmError(format!(
                                "Error reading original template file from path `{}` : {} ",
                                e,
                                &template_path.to_string_lossy()
                            ))
                        })?
                        .to_string();

                    Some(MethodSpecificRenderedDocumentDebug::Helm(
                        MethodSpecificRenderedDocumentDebugHelm { original_template },
                    ))
                };

                result_documents.push(RenderedDocument {
                    resource,
                    source_name: source_name.to_string(),
                    source_type: ManifestSource::Helm(self.clone()),
                    debug: RenderedDocumentDebug {
                        resource_string_before_parse: Some(yaml_content.clone()),
                        resource_source_path: Some(source_path.clone()),
                        method_specific,
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

    pub async fn get_chart(
        &self,
        repo_paths: &RepositoryPaths,
        source_name: &str,
        cluster_variables: &HashMap<String, serde_json::Value>,
    ) -> Result<(), HelmRepoError> {
        // local chart,  check if the folder exists
        let source_path = repo_paths
            .mows_repo_source_path
            .join("sources")
            .join(source_name);
        let chart_path = source_path.join(&self.chart_name);

        match &self.urls {
            Some(uris) => {
                let mut helm_repository_index_and_url: Option<(HelmRepositoryIndex, String)> = None;
                let mut fetch_errors: Vec<String> = Vec::new();
                const MAX_RETRIES: u32 = 3;
                const RETRY_DELAY_MS: u64 = 1000;

                for remote_repository_url in uris {
                    let mut last_error = None;

                    for attempt in 1..=MAX_RETRIES {
                        match self
                            .fetch_remote_repository_index(remote_repository_url)
                            .await
                        {
                            Ok(index) => {
                                if attempt > 1 {
                                    debug!(
                                        "Successfully fetched Helm Repository Index from {} on attempt {}",
                                        remote_repository_url, attempt
                                    );
                                }
                                helm_repository_index_and_url =
                                    Some((index, remote_repository_url.to_string()));
                                break;
                            }
                            Err(e) => {
                                debug!(
                                    "Attempt {}/{} failed to fetch from {}: {}",
                                    attempt, MAX_RETRIES, remote_repository_url, e
                                );
                                last_error = Some(e);

                                if attempt < MAX_RETRIES {
                                    tokio::time::sleep(tokio::time::Duration::from_millis(
                                        RETRY_DELAY_MS * attempt as u64,
                                    ))
                                    .await;
                                }
                            }
                        }
                    }

                    if helm_repository_index_and_url.is_some() {
                        break;
                    }

                    if let Some(e) = last_error {
                        let error_msg = format!(
                            "Failed to fetch from {} after {} attempts: {}",
                            remote_repository_url, MAX_RETRIES, e
                        );
                        debug!("{}", error_msg);
                        fetch_errors.push(error_msg);
                    }
                }

                self.fetch_remote_chart(
                    repo_paths,
                    &helm_repository_index_and_url.ok_or_else(|| {
                        HelmRepoError::FetchHelmChartError(format!(
                            "Error fetching HelmChart '{}' from all {} repository URL(s). Errors:\n  - {}",
                            self.chart_name,
                            uris.len(),
                            fetch_errors.join("\n  - ")
                        ))
                    })?,
                    source_name,
                )
                .await?;
            }
            None => {
                if !Path::new(&chart_path).exists() {
                    return Err(HelmRepoError::FetchHelmChartError(format!(
                        "Error fetching HelmChart: local chart: {} not found at {}",
                        self.chart_name,
                        chart_path.to_str().unwrap()
                    )));
                }
            }
        };

        replace_cluster_variables_in_folder_in_place(&chart_path, cluster_variables)
            .await
            .map_err(|e| HelmRepoError::RenderHelmError(format!("Error rendering Helm: {}", e)))?;

        Ok(())
    }

    pub async fn fetch_remote_repository_index(
        &self,
        url: &str,
    ) -> Result<HelmRepositoryIndex, HelmRepoError> {
        // add index.yaml to the end of the URL if it doesn't exist

        let req_url = if url.ends_with("index.yaml") {
            url.to_string()
        } else {
            if url.ends_with("/") {
                format!("{}index.yaml", url)
            } else {
                format!("{}/index.yaml", url)
            }
        };

        debug!(
            "Fetching Helm Repository Index from: {:?}",
            req_url.to_string()
        );

        let client = mows_common_rust::reqwest::new_reqwest_client()
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
            serde_yaml_neo::from_str(&helm_repository_index_string).map_err(|e| {
                HelmRepoError::FetchHelmRepoError(format!(
                    "Error parsing HelmRepo: {} while parsing string: {}",
                    e, helm_repository_index_string
                ))
            })?;

        debug!("Fetched Helm Repository Index");

        Ok(helm_repository_index)
    }

    pub async fn fetch_remote_chart(
        &self,
        repository_paths: &RepositoryPaths,
        helm_repository_index_and_url: &(HelmRepositoryIndex, String),
        source_name: &str,
    ) -> Result<(), HelmRepoError> {
        let helm_repo_index = &helm_repository_index_and_url.0;
        let chart_index_root_url = &helm_repository_index_and_url.1;

        let chart_index_url = Url::parse(chart_index_root_url)
            .map_err(|e| HelmRepoError::FetchHelmChartError(format!("Error parsing URL: {}", e)))?
            .join("index.yaml")
            .map_err(|e| HelmRepoError::FetchHelmChartError(format!("Error joining URL: {}", e)))?;

        let manifest_declared_digest =
            self.sha256_digest
                .clone()
                .ok_or(HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: missing digest"
                )))?;

        let manifest_declared_version =
            self.version
                .clone()
                .ok_or(HelmRepoError::FetchHelmChartError(format!(
                    "Error fetching HelmChart: missing version"
                )))?;

        let selected_chart_versions = helm_repo_index
            .entries
            .get(&self.chart_name)
            .ok_or_else(|| {
                HelmRepoError::FetchHelmChartError(format!(
                    "Could not find HelmChart with name: {} in the fetched Helm repository index from: {}",
                    self.chart_name, chart_index_url
                ))
            })?
            .iter()
            .find(|entry| entry.digest == manifest_declared_digest)
            .ok_or(HelmRepoError::FetchHelmChartError(format!(
                "Could not find HelmChart with digest: {}",
                self.chart_name
            )))?;

        // check if the version matches
        if selected_chart_versions.version != manifest_declared_version {
            return Err(HelmRepoError::FetchHelmChartError(format!(
                "Version mismatch with the digest. Digest matching version: {}, Manifest declared version: {}",
                selected_chart_versions.version, manifest_declared_version
            )));
        }

        let chart_urls =
            Self::get_remote_chart_urls(chart_index_root_url, &selected_chart_versions.urls)
                .await?;

        let store_path_with_repo_archive = download_or_get_cached_file(
            &chart_urls,
            &repository_paths.artifact_path,
            &manifest_declared_digest,
            None,
        )
        .await
        .map_err(|e| {
            HelmRepoError::FetchHelmChartError(format!("Error fetching HelmChart: {}", e))
        })?;

        let chart_target_directory = repository_paths
            .mows_repo_source_path
            .join("sources")
            .join(source_name);

        let archive_file =
            std::fs::File::open(Path::new(&store_path_with_repo_archive)).map_err(|e| {
                HelmRepoError::FetchHelmChartError(format!("Error opening file: {}", e))
            })?;

        let uncompressed_file = GzDecoder::new(archive_file);

        let mut archive = tar::Archive::new(uncompressed_file);

        archive.unpack(&chart_target_directory).map_err(|e| {
            HelmRepoError::FetchHelmChartError(format!("Error unpacking file: {}", e))
        })?;

        Ok(())
    }

    async fn get_remote_chart_urls(
        repository_index_url: &str,
        chart_urls: &Vec<String>,
    ) -> Result<Vec<Url>, HelmRepoError> {
        let mut urls = vec![];

        for url in chart_urls {
            urls.push(
                Url::parse(url).unwrap_or(
                    Url::parse(&repository_index_url)
                        .map_err(|e| {
                            HelmRepoError::FetchHelmChartError(format!("Error parsing URL: {}", e))
                        })?
                        .join(url)
                        .map_err(|e| {
                            HelmRepoError::FetchHelmChartError(format!("Error joining URL: {}", e))
                        })?,
                ),
            );
        }

        Ok(urls)
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

/*
*1
the trait bound `fn(axum::Json<RenderRepositoriesReqBody>) -> impl futures::Future<Output = axum::Json<ApiResponse<RenderRepositoriesResBody>>> {render_repositories}: Handler<_, _>` is not satisfied
the following other types implement trait `Handler<T, S>`:
`Layered<L, H, T, S>` implements `Handler<T, S>`
`MethodRouter<S>` implements `Handler<(), S>`rustcClick for full compiler diagnostic
lib.rs(134, 57): Actual error occurred here
lib.rs(134, 24): required by a bound introduced by this call
method_routing.rs(575, 12): required by a bound in `MethodRouter::<S>::on`

in src/api/repository.rs:18:37
pub fn router() -> OpenApiRouter {      HERE
    OpenApiRouter::new().routes(routes!(render_repositories))
}


*/
