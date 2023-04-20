use metadata::{
    clues::get_clues, config::CONFIG, db::DB, exiftool::get_metadata_exiftool,
    external::lookup::external_lookup, metadata_types::MetadataResult,
};
use mongodb::options::ClientOptions;
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
        db.dev_clear_metadata_app_data().await?;
    }
    loop {
        let unscanned_file = match db.get_file_for_processing().await {
            Ok(file) => file,
            Err(e) => {
                println!("Error getting files for processing from db: {:?}", e);
                None
            }
        };
        match unscanned_file {
            Some(file) => {
                println!("Scanning {}", file.path);
                let exifdata = match get_metadata_exiftool(&file.path).await {
                    Ok(ed) => Some(ed),
                    Err(e) => {
                        println!("Error: {}", e);
                        None
                    }
                };

                let clues = get_clues(&file, &exifdata).await?;
                let mut metadata_result = MetadataResult {
                    exifdata,
                    clues,
                    external: None,
                };

                metadata_result.external = Some(external_lookup(&metadata_result).await?);

                //dbg!(&metadata);

                db.update_file(&file.file_id, metadata_result).await?;
            }
            None => {
                println!("No files to process");
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            }
        }
    }
}
