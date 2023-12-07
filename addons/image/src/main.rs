use anyhow::bail;
use filez_common::{
    server::FilezFile,
    storage::index::{get_app_data_folder_for_file, get_storage_location_from_file},
};
use imageprocessing::{
    config::CONFIG,
    convert::{convert, convert_raw},
    db::DB,
    exiftool::extract_album_art,
    external::video_poster::get_video_poster_amazon,
    image_types::ProcessedImage,
    metadata_types::Metadata,
    utils::{get_resolutions, is_raw},
};
use mongodb::options::ClientOptions;
use std::path::PathBuf;

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // reference variables declared with lazy_static because they are initialized on first access
    let _ = &CONFIG.db;
    let config = &CONFIG;
    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;
    if config.dev.clear_own_app_data_on_start {
        println!("Cleared app data");
        db.dev_clear_image_processor_app_data().await?;
    }
    loop {
        let file = match db.get_file_for_processing().await {
            Ok(file) => file,
            Err(e) => {
                println!("Error getting file for processing from db: {:?}", e);
                None
            }
        };

        let mut image_processing_result: Option<ProcessedImage> = None;
        let mut error: Option<String> = None;
        match file {
            Some(file) => {
                println!("Processing file: {:?}", file.name);

                let file_source_path =
                    get_storage_location_from_file(&config.storage, &file)?.full_path;
                let target_folder_path =
                    get_app_data_folder_for_file(&config.storage, &file, "image")?.file_folder;

                if file.mime_type.starts_with("audio/") {
                    match handle_audio(&file_source_path, &target_folder_path).await {
                        Some(album_art) => {
                            image_processing_result = Some(album_art);
                        }
                        None => {
                            error = Some("No thumbnail found for audio file".to_string());
                        }
                    };
                } else if file.mime_type.starts_with("image/") {
                    match handle_image(&file, &file_source_path, &target_folder_path).await {
                        Ok(image) => {
                            image_processing_result = Some(image);
                        }
                        Err(e) => {
                            error = Some(e.to_string());
                        }
                    };
                } else if file.mime_type.starts_with("video/") {
                    match handle_video(&file, &file_source_path, &target_folder_path).await {
                        Ok(image) => {
                            image_processing_result = Some(image);
                        }
                        Err(e) => {
                            error = Some(e.to_string());
                        }
                    };
                } else {
                    error = Some("Unknown file type".to_string());
                }

                match db
                    .update_image_processing_status_finished(
                        &file.file_id,
                        &error,
                        &image_processing_result,
                    )
                    .await
                {
                    Ok(_) => {
                        println!("Updated file in db: {:?}", image_processing_result);
                    }
                    Err(e) => {
                        println!("Error updating file in db: {:?}", e);
                    }
                };
            }
            None => {
                println!("No files to process");
                tokio::time::sleep(std::time::Duration::from_secs(config.timeout_seconds)).await;
            }
        }
    }
}

pub async fn try_video_poster(
    file: &FilezFile,
    target_folder_path: &PathBuf,
) -> anyhow::Result<PathBuf> {
    if !&CONFIG.external.omdb_amazon_posters {
        bail!("OMDB Amazon posters are disabled");
    };

    if let Some(m) = file.app_data.get("metadata") {
        if let Ok(metadata) = serde_json::from_value::<Metadata>(m.clone()) {
            if let Some(metadata_result) = metadata.result {
                if let Some(external) = metadata_result.external {
                    if let Some(omdb) = external.omdb {
                        if let Some(poster_path) = omdb.poster {
                            match get_video_poster_amazon(&poster_path, target_folder_path).await {
                                Ok(file_path) => return Ok(file_path),
                                Err(e) => bail!("Could not get video poster: {}", e),
                            }
                        }
                    }
                }
            }
        }
    };

    bail!("No video poster url found")
}

pub async fn handle_video(
    file: &FilezFile,
    source_path: &PathBuf,
    target_folder_path: &PathBuf,
) -> anyhow::Result<ProcessedImage> {
    let path = match try_video_poster(file, target_folder_path).await {
        Ok(path) => path,
        Err(e) => {
            // try something else like thumbnail extraction or similar
            bail!("Error getting video poster: {}", e);
        }
    };

    convert(&path, target_folder_path).await
}

pub async fn handle_image(
    file: &FilezFile,
    source_path: &PathBuf,
    target_folder_path: &PathBuf,
) -> anyhow::Result<ProcessedImage> {
    let mut path = source_path.clone();

    // extract the thumbnail from the images first for a quicker preview
    // even non raw images sometimes have a thumbnail

    if is_raw(file) {
        match convert_raw(&path, target_folder_path).await {
            Ok(raw_path) => {
                path = raw_path;
            }
            Err(e) => {
                bail!("Error converting raw image: {}", e);
            }
        }
    }

    convert(&path, target_folder_path).await
}

pub async fn handle_audio(
    source_path: &PathBuf,
    target_folder_path: &PathBuf,
) -> Option<ProcessedImage> {
    match extract_album_art(source_path, target_folder_path).await {
        Ok(album_art) => Some(album_art),
        Err(e) => {
            println!("Error extracting thumbnail: {}", e);
            None
        }
    }
}
