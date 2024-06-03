use filez_common::storage::index::{get_app_data_folder_for_file, get_storage_location_from_file};
use mongodb::options::ClientOptions;
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;
use video::{config::CONFIG, convert::convert, db::DB};

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
        db.dev_clear_video_processor_app_data().await?;
    }
    loop {
        let file = match db.get_video_for_processing().await {
            Ok(file) => file,
            Err(e) => {
                println!("Error getting file for processing from db: {:?}", e);
                None
            }
        };
        match file {
            Some(file) => {
                let file_source_path =
                    get_storage_location_from_file(&config.storage, &file)?.full_path;
                let file_target_folder =
                    get_app_data_folder_for_file(&config.storage, &file, "video")?.file_folder;

                println!("Processing file: {:?}", &file.file_id);
                let res = match convert(&file_source_path, &file_target_folder).await {
                    Ok(_) => None,
                    Err(e) => Some(e.to_string()),
                };
                println!("File processed: {:?}", &res);

                match db.update_video_processing_status(&file.file_id, res).await {
                    Ok(_) => println!("Updated file status in db"),
                    Err(e) => println!("Error updating file status in db: {:?}", e),
                };
            }
            None => {
                println!("No file found for processing");
                tokio::time::sleep(std::time::Duration::from_secs(config.timeout_seconds)).await;
            }
        }
    }
}
