use crate::types::Manifest;
use anyhow::Context;
use futures::StreamExt;
use gtmpl_derive::Gtmpl;
use gtmpl_ng::all_functions::all_functions;
use gtmpl_ng::helm_functions::serde_json_hashmap_to_gtmpl_hashmap;
use gtmpl_ng::{Context as GtmplContext, Template, Value as GtmplValue};
use kube::{
    api::{ApiResource, DynamicObject},
    discovery::{ApiCapabilities, Scope},
    Api, Client,
};
use sha2::Digest;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    signal,
};
use tracing::debug;
use url::Url;

pub async fn parse_manifest(input: &str) -> anyhow::Result<Manifest> {
    // this workaround is needed because serde_yaml does not support nested enums

    let yaml_value: serde_yaml_ng::Value = serde_yaml_ng::from_str(input)?;
    let json_string = serde_json::to_string(&yaml_value)?;
    let manifest: Manifest = serde_json::from_str(&json_string)?;

    Ok(manifest)
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

pub async fn get_all_file_paths_recursive(path: &Path) -> anyhow::Result<Vec<PathBuf>> {
    let mut file_paths = Vec::new();

    let mut dir = tokio::fs::read_dir(path).await.context(format!(
        "Error reading directory: {}",
        path.to_str().unwrap_or("")
    ))?;

    while let Some(entry) = dir.next_entry().await.context(format!(
        "Error reading next entry in directory: {}",
        path.to_str().unwrap_or("")
    ))? {
        let path = entry.path();

        if path.is_dir() {
            file_paths.append(
                &mut Box::pin(get_all_file_paths_recursive(&path))
                    .await
                    .context(format!(
                        "Error getting all file paths recursively in directory: {}",
                        path.to_str().unwrap_or("")
                    ))?,
            );
        } else {
            file_paths.push(path);
        }
    }

    Ok(file_paths)
}
/// all: Ignore namespace and return cluster-wide API
pub fn get_dynamic_kube_api(
    api_resource: ApiResource,
    api_capabilities: ApiCapabilities,
    client: Client,
    namespace: Option<&str>,
    all: bool,
) -> Api<DynamicObject> {
    if api_capabilities.scope == Scope::Cluster || all {
        Api::all_with(client, &api_resource)
    } else if let Some(namespace) = namespace {
        Api::namespaced_with(client, namespace, &api_resource)
    } else {
        Api::default_namespaced_with(client, &api_resource)
    }
}

pub async fn replace_cluster_variables_in_folder_in_place(
    directory_path: &PathBuf,
    cluster_variables: &HashMap<String, serde_json::Value>,
) -> anyhow::Result<()> {
    // replace cluster variables in all files recursively
    let file_paths = get_all_file_paths_recursive(&directory_path)
        .await
        .context(format!(
            "Error getting all file paths recursively in directory: {}",
            directory_path.to_str().unwrap_or("")
        ))?;

    for file_path in file_paths {
        let original_file_content = tokio::fs::read_to_string(&file_path).await?;

        let rendered_content =
            replace_cluster_variables_in_string(&original_file_content, cluster_variables)
                .await
                .context(format!(
                    "Error replacing cluster variables in file: {}",
                    file_path.to_str().unwrap_or("")
                ))?;

        tokio::fs::write(&file_path, rendered_content).await?;
    }

    Ok(())
}

pub async fn replace_cluster_variables_in_string(
    input: &str,
    cluster_variables: &HashMap<String, serde_json::Value>,
) -> anyhow::Result<String> {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    #[derive(Gtmpl)]
    struct LocalContext {
        config: HashMap<String, GtmplValue>,
    }

    let context = GtmplContext::from(LocalContext {
        config: serde_json_hashmap_to_gtmpl_hashmap(cluster_variables),
    });

    let temp_token_left = "{lt.pm.reserved.mows.cloud";
    let temp_token_right = "rt.pm.reserved.mows.cloud}";

    let original_file_content = input
        .replace("{{", &temp_token_left)
        .replace("}}", &temp_token_right)
        .replace("{§", "{{")
        .replace("§}", "}}");

    template_creator
        .parse(&original_file_content)
        .context("Error parsing template")?;

    let rendered_content = template_creator.render(&context)?;

    Ok(rendered_content
        .replace(temp_token_left, "{{")
        .replace(temp_token_right, "}}"))
}

#[derive(thiserror::Error, Debug)]
pub enum GetRemoteFileError {
    #[error("Digest Mismatch: expected: {expected_digest}, found remote: {found_digest}")]
    DigestMismatch {
        expected_digest: String,
        found_digest: String,
    },
    #[error(transparent)]
    IoError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

pub async fn download_or_get_cached_file(
    urls: &Vec<Url>,
    temp_target_directory: &Path,
    expected_sha256_digest: &str,
    size_limit: Option<usize>,
) -> Result<PathBuf, GetRemoteFileError> {
    let target_file_path = temp_target_directory.join(expected_sha256_digest);

    if target_file_path.exists() {
        read_local_file(expected_sha256_digest, &target_file_path).await
    } else {
        const MAX_RETRIES: u32 = 3;
        const RETRY_DELAY_MS: u64 = 1000;
        let mut errors = Vec::new();

        for url in urls {
            let mut last_error = None;

            for attempt in 1..=MAX_RETRIES {
                match fetch_from_url(url, &target_file_path, expected_sha256_digest, size_limit).await {
                    Ok(v) => {
                        if attempt > 1 {
                            debug!("Successfully downloaded file from {} on attempt {}", url, attempt);
                        }
                        return Ok(v);
                    }
                    Err(e) => {
                        debug!(
                            "Attempt {}/{} failed to download file from {}: {}",
                            attempt, MAX_RETRIES, url, e
                        );
                        last_error = Some(e);

                        if attempt < MAX_RETRIES {
                            tokio::time::sleep(tokio::time::Duration::from_millis(
                                RETRY_DELAY_MS * attempt as u64
                            ))
                            .await;
                        }
                    }
                }
            }

            if let Some(e) = last_error {
                errors.push(format!("Failed after {} attempts: {}", MAX_RETRIES, e));
            }
        }

        Err(GetRemoteFileError::AnyhowError(anyhow::anyhow!(
            "Failed to download file from any of the {} URL(s). Errors:\n  - {}",
            urls.len(),
            errors.join("\n  - ")
        )))
    }
}

async fn read_local_file(
    expected_sha256_digest: &str,
    target_file_path: &PathBuf,
) -> Result<PathBuf, GetRemoteFileError> {
    let file = tokio::fs::File::open(target_file_path).await?;
    let mut hasher = sha2::Sha256::new();
    let mut reader = tokio::io::BufReader::new(file);
    let mut buffer = [0; 1024];
    loop {
        let n = reader.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let found_file_digest = format!("{:x}", hasher.finalize());
    if found_file_digest == expected_sha256_digest {
        return Ok(target_file_path.to_path_buf());
    } else {
        tokio::fs::remove_file(&target_file_path).await?;
        return Err(GetRemoteFileError::DigestMismatch {
            expected_digest: expected_sha256_digest.to_string(),
            found_digest: found_file_digest,
        }
        .into());
    }
}

async fn fetch_from_url(
    url: &Url,
    target_file_path: &PathBuf,
    expected_sha256_digest: &str,
    size_limit: Option<usize>,
) -> Result<PathBuf, GetRemoteFileError> {
    let reqwest_client = mows_common_rust::reqwest::new_reqwest_client()
        .await
        .map_err(|e| {
            GetRemoteFileError::AnyhowError(anyhow::anyhow!("Error creating reqwest client: {}", e))
        })?;

    let file = tokio::fs::File::create(&target_file_path)
        .await
        .context(format!(
            "Failed to create file at path: {}",
            target_file_path.to_str().unwrap_or("")
        ))?;

    let mut writer = tokio::io::BufWriter::new(file);

    let mut hasher = sha2::Sha256::new();

    let mut byte_stream = reqwest_client
        .get(url.clone())
        .send()
        .await
        .map_err(|e| {
            GetRemoteFileError::AnyhowError(anyhow::anyhow!("Error sending request to url: {}", e))
        })?
        .bytes_stream();

    let mut current_size = 0;

    while let Some(chunk) = byte_stream.next().await {
        let chunk = chunk.map_err(|e| {
            GetRemoteFileError::AnyhowError(anyhow::anyhow!("Error reading chunk: {}", e))
        })?;

        if let Some(size_limit) = size_limit {
            current_size += chunk.len();
            if current_size > size_limit {
                tokio::fs::remove_file(&target_file_path)
                    .await
                    .map_err(|e| {
                        GetRemoteFileError::AnyhowError(anyhow::anyhow!(
                            "Error removing file: {}",
                            e
                        ))
                    })?;
                return Err(GetRemoteFileError::AnyhowError(anyhow::anyhow!(
                    "Downloaded file exceeds size limit of {} bytes",
                    size_limit
                )));
            }
        }

        hasher.update(&chunk);

        writer.write_all(&chunk).await?;

        writer.flush().await?;
    }

    let found_file_digest = format!("{:x}", hasher.finalize());

    if found_file_digest == expected_sha256_digest {
        return Ok(target_file_path.to_path_buf());
    } else {
        tokio::fs::remove_file(&target_file_path).await?;

        return Err(GetRemoteFileError::DigestMismatch {
            expected_digest: expected_sha256_digest.to_string(),
            found_digest: found_file_digest,
        });
    }
}

pub fn parse_resources_from_file_extension(
    extension: &str,
    file_content: &str,
) -> anyhow::Result<Vec<serde_json::Value>> {
    let mut resources: Vec<serde_json::Value> = vec![];

    if extension == "json" {
        let resource: serde_json::Value = serde_json::from_str(&file_content)?;
        resources.push(resource);
    } else if extension == "toml" {
        for document in file_content.split("+++\n") {
            let resource: serde_json::Value = toml::from_str(document)?;

            resources.push(resource);
        }
    } else if extension == "yaml" || extension == "yml" {
        for document in file_content.split("---\n") {
            let resource = serde_yaml_ng::from_str(document)?;
            resources.push(resource);
        }
    } else {
        anyhow::bail!("Unsupported file extension: {}", extension);
    }

    resources.retain(|r| !r.is_null());

    Ok(resources)
}
