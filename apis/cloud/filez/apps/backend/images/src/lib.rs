use std::path::{Path, PathBuf};

use crate::{config::config, errors::ImageError};
use filez_client::{
    client::ApiClient,
    futures::StreamExt,
    reqwest::Body,
    tokio_util::codec::{BytesCodec, FramedRead},
    types::{
        CreateFileVersionRequestBody, FileVersionMetadata, FilezJob, JobType, JobTypeCreatePreview,
    },
};
use image::ImageReader;
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

pub mod config;
pub mod errors;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct ImagePreviewConfig {
    pub widths: Vec<u32>,
    pub formats: Vec<ImageFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deep_zoom_image: Option<DeepZoomImageConfig>,
}

impl ImagePreviewConfig {
    pub fn default() -> Self {
        Self {
            widths: vec![100, 250, 500, 1000],
            formats: vec![ImageFormat::Jpeg, ImageFormat::Avif],
            deep_zoom_image: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct DeepZoomImageConfig {}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum ImageFormat {
    Jpeg,
    Png,
    Webp,
    Avif,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct PreviewFile {
    pub path: PathBuf,
    pub mime_type: String,
    pub app_path: String,
}

pub async fn handle_job(job: FilezJob, filez_client: &ApiClient) -> Result<(), ImageError> {
    match job.execution_information.job_type {
        JobType::CreatePreview(create_preview_infos) => {
            let preview_config = serde_json::from_value::<ImagePreviewConfig>(
                create_preview_infos.preview_config.clone(),
            )?;
            create_previews(preview_config, &create_preview_infos, filez_client).await
        }
        _ => {
            return Err(ImageError::UnsupportedJobType(
                job.execution_information.job_type,
            ));
        }
    }
}

async fn create_previews(
    image_preview_config: ImagePreviewConfig,
    job_execution_information: &JobTypeCreatePreview,
    filez_client: &ApiClient,
) -> Result<(), ImageError> {
    let config = get_current_config_cloned!(config());
    let source_path = Path::new(&config.working_directory)
        .join(&job_execution_information.file_id.to_string())
        .join(&job_execution_information.file_version_number.to_string())
        .join("source");

    // Ensure the source path exists
    if !source_path.exists() {
        tokio::fs::create_dir_all(&source_path.parent().unwrap()).await?;
    }

    let target_path = Path::new(&config.working_directory)
        .join(&job_execution_information.file_id.to_string())
        .join(&job_execution_information.file_version_number.to_string())
        .join("target");

    let mut stream = filez_client
        .get_file_version_content(
            job_execution_information.file_id,
            Some(job_execution_information.file_version_number),
            None,
            None,
            false,
            0,
        )
        .await?
        .bytes_stream();

    // write the file by streaming it to the source path
    let mut file = tokio::fs::File::create(&source_path).await?;
    while let Some(chunk) = stream.next().await {
        file.write_all(&chunk.map_err(|e| anyhow::Error::new(e))?)
            .await?;
    }
    file.flush().await?;

    // Create target directory if it does not exist
    if !target_path.exists() {
        tokio::fs::create_dir_all(&target_path).await?;
    }

    let preview_files =
        create_basic_versions(&source_path, &target_path, &image_preview_config).await?;

    // Upload the created preview files
    for preview_file in preview_files.iter() {
        filez_client
            .create_file_version(CreateFileVersionRequestBody {
                file_id: job_execution_information.file_id,
                version: Some(job_execution_information.file_version_number),
                app_path: Some(preview_file.app_path.clone()),
                mime_type: preview_file.mime_type.clone(),
                content_expected_sha256_digest: None,
                size: std::fs::metadata(&preview_file.path)
                    .map_err(|e| ImageError::IoError(e.into()))?
                    .len(),
                storage_quota_id: job_execution_information.storage_quota_id,
                metadata: FileVersionMetadata {},
            })
            .await?;
    }

    for preview_file in preview_files.iter() {
        let file = tokio::fs::File::open(&preview_file.path).await?;

        let stream = FramedRead::new(file, BytesCodec::new());

        let body = Body::wrap_stream(stream);

        filez_client
            .file_versions_content_tus_patch(
                job_execution_information.file_id,
                Some(job_execution_information.file_version_number),
                Some(preview_file.app_path.clone()),
                Some(preview_file.app_path.clone()),
                body,
            )
            .await?;
    }

    Ok(())
}

async fn create_basic_versions(
    source_path: &PathBuf,
    target_path: &PathBuf,
    config: &ImagePreviewConfig,
) -> Result<Vec<PreviewFile>, ImageError> {
    let mut preview_files = Vec::new();
    let file_handle = std::fs::File::open(source_path)?;
    let buffered_reader = std::io::BufReader::new(file_handle);
    let image = ImageReader::new(buffered_reader)
        .with_guessed_format()?
        .decode()?;

    for width in &config.widths {
        for format in &config.formats {
            let resized_image = image.resize(
                *width,
                image.height(),
                image::imageops::FilterType::Lanczos3,
            );
            let file_name = format!(
                "{}.{}",
                width,
                match format {
                    ImageFormat::Jpeg => "jpg",
                    ImageFormat::Png => "png",
                    ImageFormat::Webp => "webp",
                    ImageFormat::Avif => "avif",
                }
            );

            let target_file_path = target_path.join(&file_name);
            resized_image.save(&target_file_path)?;
            preview_files.push(PreviewFile {
                path: target_file_path,
                mime_type: match format {
                    ImageFormat::Jpeg => "image/jpeg".to_string(),
                    ImageFormat::Png => "image/png".to_string(),
                    ImageFormat::Webp => "image/webp".to_string(),
                    ImageFormat::Avif => "image/avif".to_string(),
                },
                app_path: file_name,
            });
        }
    }

    Ok(preview_files)
}
