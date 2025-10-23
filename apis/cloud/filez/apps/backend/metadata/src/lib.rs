use crate::{
    config::config,
    errors::{InnerMetadataError, MetadataError},
};
use anyhow::anyhow;
use filez_server_client::utils::stream_file_to_path;
use filez_server_client::{
    client::ApiClient,
    types::{
        FileMetadata, FilezJob, GetFilesRequestBody, JobType, JobTypeExtractMetadata,
        UpdateFileChangeset, UpdateFileRequestBody,
    },
};
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror_context::Context;
use tracing::trace;
pub mod config;
pub mod errors;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct MetadataExtractionConfig {
    #[serde(default)]
    pub skip_text: bool,
    #[serde(default)]
    pub skip_exif: bool,
    #[serde(default)]
    pub skip_iptc: bool,
    #[serde(default)]
    pub skip_xmp: bool,
    #[serde(default)]
    pub skip_icc_profile: bool,
}

impl Default for MetadataExtractionConfig {
    fn default() -> Self {
        Self {
            skip_text: false,
            skip_exif: false,
            skip_iptc: false,
            skip_xmp: false,
            skip_icc_profile: false,
        }
    }
}

impl MetadataExtractionConfig {
    pub fn from_job_config(
        extract_metadata_infos: &JobTypeExtractMetadata,
    ) -> Result<Self, MetadataError> {
        let config = serde_json::from_value::<MetadataExtractionConfig>(
            extract_metadata_infos.extract_metadata_config.clone(),
        )?;
        Ok(config)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct MetadataFile {
    pub path: PathBuf,
    pub mime_type: String,
    pub app_path: String,
}

#[tracing::instrument(level = "trace")]
pub async fn handle_job(job: FilezJob, filez_client: &ApiClient) -> Result<(), MetadataError> {
    match job.execution_information.job_type {
        JobType::ExtractMetadata(extract_metadata_infos) => {
            let metadata_extraction_config =
                MetadataExtractionConfig::from_job_config(&extract_metadata_infos)?;
            extract_metadata(
                &metadata_extraction_config,
                &extract_metadata_infos,
                filez_client,
            )
            .await
        }
        _ => {
            return Err(
                InnerMetadataError::UnsupportedJobType(job.execution_information.job_type).into(),
            );
        }
    }
}

#[tracing::instrument(level = "trace")]
async fn extract_metadata(
    metadata_extraction_config: &MetadataExtractionConfig,
    job_execution_information: &JobTypeExtractMetadata,
    filez_client: &ApiClient,
) -> Result<(), MetadataError> {
    let config = get_current_config_cloned!(config());
    let source_path = Path::new(&config.working_directory)
        .join(&job_execution_information.file_id.to_string())
        .join(&job_execution_information.file_version_number.to_string())
        .join("source");

    stream_file_to_path(
        filez_client,
        job_execution_information.file_id,
        job_execution_information.file_version_number,
        &source_path,
    )
    .await?;

    let extracted_metadata =
        extract_metadata_using_exiftool(&source_path, metadata_extraction_config).await?;

    trace!("Extracted metadata: {:?}", extracted_metadata);

    // Get the existing file to preserve existing metadata
    let get_file_response = filez_client
        .get_files(GetFilesRequestBody {
            file_ids: vec![job_execution_information.file_id],
        })
        .await
        .context("Failed to get file")?;

    let existing_file = get_file_response.data.files.first().ok_or(anyhow::anyhow!(
        "File with ID {} not found",
        job_execution_information.file_id
    ))?;

    // Update the file's extracted_data field while preserving other metadata
    let update_request = UpdateFileRequestBody {
        file_id: job_execution_information.file_id,
        changeset: UpdateFileChangeset {
            new_file_metadata: Some(FileMetadata {
                default_preview_app_id: existing_file.metadata.default_preview_app_id,
                extracted_data: extracted_metadata,
                private_app_data: existing_file.metadata.private_app_data.clone(),
                shared_app_data: existing_file.metadata.shared_app_data.clone(),
            }),
            new_file_mime_type: None,
            new_file_name: None,
        },
    };

    filez_client
        .update_file(update_request)
        .await
        .context("Failed to update file with extracted metadata")?;

    Ok(())
}

#[tracing::instrument(level = "trace")]
async fn extract_metadata_using_exiftool(
    source_path: &PathBuf,
    metadata_extraction_config: &MetadataExtractionConfig,
) -> Result<serde_json::Value, MetadataError> {
    trace!("Extracting metadata from: {:?}", source_path);

    let output = tokio::process::Command::new("exiftool")
        .arg("-json")
        .arg("-a") // Allow duplicate tags
        .arg("-G") // Show group names
        .arg(source_path)
        .output()
        .await
        .context("Failed to execute exiftool")?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(InnerMetadataError::ExiftoolError(error_msg.to_string()).into());
    }

    let json_metadata = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value =
        serde_json::from_str(&json_metadata).context("Failed to parse exiftool JSON output")?;

    // Exiftool returns an array, extract the first element
    let flat_metadata = parsed
        .as_array()
        .and_then(|arr| arr.first())
        .ok_or(anyhow!(
            "Expected exiftool to return an array with at least one element"
        ))?;

    // Convert flat structure with colon-separated keys into nested hierarchy
    let nested_metadata = restructure_metadata(flat_metadata.clone(), metadata_extraction_config)?;

    Ok(nested_metadata)
}

fn restructure_metadata(
    flat_data: serde_json::Value,
    config: &MetadataExtractionConfig,
) -> Result<serde_json::Value, MetadataError> {
    use serde_json::Map;

    let flat_obj = flat_data
        .as_object()
        .ok_or(anyhow!("Expected flat_data to be a JSON object"))?;

    let mut nested = Map::new();

    for (key, value) in flat_obj {
        // Skip internal/unnecessary metadata fields
        if key == "SourceFile"
            || key.starts_with("ExifTool:")
            || key.starts_with("File:Directory")
            || key.starts_with("File:FileName")
            || key.starts_with("File:FileAccessDate")
            || key.starts_with("File:FileInodeChangeDate")
            || key.starts_with("File:FileModifyDate")
            || key.starts_with("File:FilePermissions")
            || key.starts_with("File:FileSize")
            || key.starts_with("File:FileType")
            || key.starts_with("File:FileTypeExtension")
        {
            continue;
        }

        let parts: Vec<&str> = key.split(':').collect();

        if parts.is_empty() {
            continue;
        }

        // Check if we should skip this metadata group
        if parts.len() > 1 {
            let group = parts[0].to_uppercase();
            let should_skip = match group.as_str() {
                "EXIF" => config.skip_exif,
                "IPTC" => config.skip_iptc,
                "XMP" => config.skip_xmp,
                "ICC_PROFILE" => config.skip_icc_profile,
                // Note: Text extraction would need a different approach (OCR/tesseract)
                // For now, we don't filter based on skip_text here
                _ => false,
            };

            if should_skip {
                continue;
            }
        }

        if parts.len() == 1 {
            // No colon, add directly to root
            nested.insert(key.clone(), value.clone());
        } else {
            // Has colon(s), create nested structure
            let mut current = &mut nested;

            for (i, part) in parts.iter().enumerate() {
                if i == parts.len() - 1 {
                    // Last part, insert the value
                    current.insert(part.to_string(), value.clone());
                } else {
                    // Intermediate part, ensure nested object exists
                    current = current
                        .entry(part.to_string())
                        .or_insert_with(|| serde_json::Value::Object(Map::new()))
                        .as_object_mut()
                        .ok_or(anyhow!("Expected nested value to be an object"))?;
                }
            }
        }
    }

    Ok(serde_json::Value::Object(nested))
}
