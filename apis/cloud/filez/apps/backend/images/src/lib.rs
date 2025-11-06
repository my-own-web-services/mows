use crate::{
    config::config,
    errors::{ImageError, InnerImageError},
};
use filez_server_client::{
    client::ApiClient,
    reqwest::Body,
    tokio_util::codec::{BytesCodec, FramedRead},
    types::{
        CreateFileVersionRequestBody, FileVersionMetadata, FileVersionQuadIdentifier, FilezJob,
        GetFileVersionsRequestBody, GetFileVersionsSelector, JobType, JobTypeCreatePreview,
        MowsAppId, UpdateFileVersionChangeset, UpdateFileVersionSelector,
        UpdateFileVersionsRequestBody,
    },
    utils::stream_file_to_path,
};
use image::{imageops::FilterType, ImageEncoder, ImageFormat, ImageReader};
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror_context::Context;
use tracing::trace;
pub mod config;
pub mod errors;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct ImagePreviewConfig {
    pub widths: Vec<u32>,
    pub formats: Vec<ImageFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deep_zoom_image: Option<DeepZoomImageConfig>,
}

impl ImagePreviewConfig {
    pub fn default() -> Self {
        Self {
            widths: vec![100, 250, 500, 1000],
            formats: vec![ImageFormat::Jpeg, ImageFormat::Avif],
            quality: Some(95),
            speed: Some(4),
            deep_zoom_image: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct DeepZoomImageConfig {}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct PreviewFile {
    pub path: PathBuf,
    pub mime_type: String,
    pub app_path: String,
}

#[tracing::instrument(level = "trace")]
pub async fn handle_job(job: FilezJob, filez_client: &ApiClient) -> Result<(), ImageError> {
    match job.execution_information.job_type {
        JobType::CreatePreview(create_preview_infos) => {
            let preview_config = serde_json::from_value::<ImagePreviewConfig>(
                create_preview_infos.preview_config.clone(),
            )?;
            create_previews(
                preview_config,
                &create_preview_infos,
                filez_client,
                job.app_id,
            )
            .await
        }
        _ => {
            return Err(
                InnerImageError::UnsupportedJobType(job.execution_information.job_type).into(),
            );
        }
    }
}

#[tracing::instrument(level = "trace")]
async fn create_previews(
    image_preview_config: ImagePreviewConfig,
    job_execution_information: &JobTypeCreatePreview,
    filez_client: &ApiClient,
    app_id: MowsAppId,
) -> Result<(), ImageError> {
    let config = get_current_config_cloned!(config());
    let source_path = Path::new(&config.working_directory)
        .join(&job_execution_information.file_id.to_string())
        .join(&job_execution_information.file_revision_index.to_string())
        .join("source");

    let source_mime_type = stream_file_to_path(
        filez_client,
        job_execution_information.file_id,
        job_execution_information.file_revision_index,
        &source_path,
    )
    .await?;

    let target_path = Path::new(&config.working_directory)
        .join(&job_execution_information.file_id.to_string())
        .join(&job_execution_information.file_revision_index.to_string())
        .join("target");

    std::fs::create_dir_all(&target_path)?;

    create_basic_versions(
        &source_path,
        &target_path,
        &image_preview_config,
        &source_mime_type,
        job_execution_information,
        filez_client,
        app_id,
    )
    .await?;

    Ok(())
}

#[tracing::instrument(level = "trace")]
async fn create_basic_versions(
    source_path: &PathBuf,
    target_path: &PathBuf,
    config: &ImagePreviewConfig,
    source_mime_type: &str,
    job_execution_information: &JobTypeCreatePreview,
    filez_client: &ApiClient,
    app_id: MowsAppId,
) -> Result<(), ImageError> {
    let file_handle = std::fs::File::open(source_path)?;
    let buffered_reader = std::io::BufReader::new(file_handle);
    trace!("Opening image file: {:?}", source_path);
    let mut image_reader = ImageReader::new(buffered_reader);
    image_reader.set_format(ImageFormat::from_mime_type(source_mime_type).ok_or(
        InnerImageError::UnsupportedImageFormat(source_mime_type.to_string()),
    )?);
    let image = image_reader.decode()?;

    for width in &config.widths {
        for format in &config.formats {
            let height = (width * image.height() / image.width()) as u32;
            let resized_image = image.resize(*width, height, FilterType::Lanczos3);
            let file_name = format!("{}.{}", width, format.extensions_str()[0]);
            trace!(
                "Resizing image to width: {}, height: {}, format: {:?}, file_name: {}",
                width,
                height,
                format,
                file_name,
            );

            let target_file_path = target_path.join(&file_name);

            trace!("Target file path for resized image: {:?}", target_file_path);

            // Save with quality control
            let quality = config.quality.unwrap_or(95);
            let speed = config.speed.unwrap_or(4);
            let output_file = std::fs::File::create(&target_file_path)?;
            let mut writer = std::io::BufWriter::new(output_file);

            match format {
                ImageFormat::Jpeg => {
                    use image::codecs::jpeg::JpegEncoder;
                    let mut encoder = JpegEncoder::new_with_quality(&mut writer, quality);
                    encoder.encode_image(&resized_image)?;
                }
                ImageFormat::Avif => {
                    use image::codecs::avif::AvifEncoder;
                    let encoder = AvifEncoder::new_with_speed_quality(&mut writer, speed, quality);
                    encoder.write_image(
                        resized_image.as_bytes(),
                        resized_image.width(),
                        resized_image.height(),
                        resized_image.color().into(),
                    )?;
                }
                _ => {
                    // For formats without quality support, use default encoding
                    resized_image.write_to(&mut writer, *format)?;
                }
            }

            let preview_file = PreviewFile {
                path: target_file_path.clone(),
                mime_type: format.to_mime_type().to_string(),
                app_path: file_name,
            };

            trace!(
                preview_file = ?preview_file,
                "Created preview file: {:?}", target_file_path
            );

            let filez_client = filez_client.clone();
            let job_execution_information = job_execution_information.clone();

            trace!("Creating file version for: {:?}", preview_file.app_path);

            let existing_file_versions = filez_client
                .get_file_versions(GetFileVersionsRequestBody {
                    selector: GetFileVersionsSelector::FileVersionQuadIdentifiers(vec![
                        FileVersionQuadIdentifier {
                            file_id: job_execution_information.file_id,
                            file_revision_index: job_execution_information.file_revision_index,
                            app_path: preview_file.app_path.clone(),
                            app_id,
                        },
                    ]),
                })
                .await
                .context("Failed to get existing file versions")?;

            let maybe_existing_version =
                existing_file_versions.data.file_versions.into_iter().next();

            match maybe_existing_version {
                Some(existing_version) => {
                    filez_client
                        .update_file_version(UpdateFileVersionsRequestBody {
                            selector: UpdateFileVersionSelector::FileVersionId(existing_version.id),
                            changeset: UpdateFileVersionChangeset {
                                new_file_version_content_size_bytes: Some(
                                    std::fs::metadata(&preview_file.path)
                                        .map_err(|e| InnerImageError::IoError(e.into()))?
                                        .len(),
                                ),
                                ..Default::default()
                            },
                        })
                        .await
                        .context("Failed to update existing file version")?;
                }
                None => {
                    filez_client
                        .create_file_version(CreateFileVersionRequestBody {
                            file_id: job_execution_information.file_id,
                            file_version_number: Some(
                                job_execution_information.file_revision_index,
                            ),
                            app_path: Some(preview_file.app_path.clone()),
                            file_version_mime_type: preview_file.mime_type.clone(),
                            content_expected_sha256_digest: None,
                            file_version_content_size_bytes: std::fs::metadata(&preview_file.path)
                                .map_err(|e| InnerImageError::IoError(e.into()))?
                                .len(),
                            storage_quota_id: job_execution_information.storage_quota_id,
                            file_version_metadata: FileVersionMetadata {},
                        })
                        .await
                        .context("Failed to create file version")?;
                }
            }

            trace!("Uploading content for: {:?}", preview_file.app_path);

            let file = tokio::fs::File::open(&preview_file.path).await?;

            let stream = FramedRead::new(file, BytesCodec::new());

            let body = Body::wrap_stream(stream);

            filez_client
                .file_versions_content_patch(
                    job_execution_information.file_id,
                    Some(job_execution_information.file_revision_index),
                    Some(preview_file.app_path.clone()),
                    0,
                    std::fs::metadata(&preview_file.path)
                        .map_err(|e| InnerImageError::IoError(e.into()))?
                        .len(),
                    body,
                )
                .await
                .context("Failed to upload to file version")?;
        }
    }

    Ok(())
}
