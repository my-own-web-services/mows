use anyhow::bail;
use imageprocessing::{
    config::CONFIG,
    convert::{convert, convert_raw},
    db::DB,
    exiftool::extract_album_art,
    external::video_poster::get_video_poster_amazon,
    image_types::ProcessedImage,
    metadata_types::Metadata,
    types::FilezFile,
    utils::get_resolutions,
};
use mongodb::options::ClientOptions;
use std::path::Path;

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
                println!("Processing file: {:?}", file.path);
                /*if file.mime_type.starts_with("audio/") {
                    match handle_audio(&file).await {
                        Some(album_art) => {
                            image_processing_result = Some(album_art);
                        }
                        None => {
                            error = Some("No thumbnail found for audio file".to_string());
                        }
                    };
                } else if file.mime_type.starts_with("image/") {
                    match handle_image(&file).await {
                        Some(image) => {
                            image_processing_result = Some(image);
                        }
                        None => {
                            error = Some("Could not create image".to_string());
                        }
                    };
                } else */
                if file.mime_type.starts_with("video/") {
                    match handle_video(&file).await {
                        Some(image) => {
                            image_processing_result = Some(image);
                        }
                        None => {
                            error = Some("Could not create image".to_string());
                        }
                    };
                } else {
                    error = Some("Unknown file type".to_string());
                }

                dbg!(&file.path);
                match db
                    .update_image_processing_status(&file.file_id, &error, &image_processing_result)
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

pub async fn try_video_poster(file: &FilezFile) -> anyhow::Result<String> {
    if !&CONFIG.external.omdb_amazon_posters {
        bail!("OMDB Amazon posters are disabled");
    };

    if let Some(m) = file.app_data.get("metadata") {
        if let Ok(metadata) = serde_json::from_value::<Metadata>(m.clone()) {
            if let Some(external) = metadata.external {
                if let Some(omdb) = external.omdb {
                    match get_video_poster_amazon(&omdb.poster, &CONFIG.storage_path, &file.file_id)
                        .await
                    {
                        Ok(file_path) => return Ok(file_path),
                        Err(e) => bail!("Could not get video poster: {}", e),
                    }
                }
            }
        }
    };

    bail!("Could not get video poster")
}

pub async fn handle_video(file: &FilezFile) -> Option<ProcessedImage> {
    let path = match try_video_poster(file).await {
        Ok(path) => path,
        Err(e) => {
            // try something else like thumbnail extraction or similar
            println!("Error getting video poster: {}", e);
            return None;
        }
    };

    let image = match image::open(&path) {
        Ok(image) => image,
        Err(e) => {
            println!("Error opening image: {}", e);
            return None;
        }
    };

    let width = image.width();
    let height = image.height();

    let resolutions = get_resolutions(width, height);

    match convert(&path, &CONFIG.storage_path, &file.file_id, &resolutions).await {
        Ok(_) => Some(ProcessedImage {
            width,
            height,
            resolutions,
        }),
        Err(e) => {
            println!("Error extracting thumbnail: {}", e);
            None
        }
    }
}

pub async fn handle_image(file: &FilezFile) -> Option<ProcessedImage> {
    let raw_formats = vec![
        "cr2", "crw", "nef", "orf", "raf", "rw2", "arw", "dng", "erf", "mrw",
    ];

    let ending = Path::new(&file.path).extension()?.to_str()?.to_lowercase();

    let mut path = file.path.clone();
    if raw_formats.contains(&ending.as_str()) {
        match convert_raw(&path, &CONFIG.storage_path, &file.file_id).await {
            Ok(target_path) => {
                path = target_path;
            }
            Err(e) => {
                println!("Error converting raw image: {}", e);
                return None;
            }
        }
    }

    let image = match image::open(&path) {
        Ok(image) => image,
        Err(e) => {
            println!("Error opening image: {}", e);
            return None;
        }
    };

    let width = image.width();
    let height = image.height();

    let resolutions = get_resolutions(width, height);

    match convert(&path, &CONFIG.storage_path, &file.file_id, &resolutions).await {
        Ok(_) => Some(ProcessedImage {
            width,
            height,
            resolutions,
        }),
        Err(e) => {
            println!("Error extracting thumbnail: {}", e);
            None
        }
    }
}

pub async fn handle_audio(file: &FilezFile) -> Option<ProcessedImage> {
    match extract_album_art(&file.path, &file.file_id).await {
        Ok(album_art) => Some(album_art),
        Err(e) => {
            println!("Error extracting thumbnail: {}", e);
            None
        }
    }
}
