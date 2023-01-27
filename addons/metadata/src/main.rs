use metadata::{
    clues::get_clues, config::CONFIG, db::DB, exiftool::get_metadata_exiftool,
    metadata_types::Metadata,
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
    let _ = &CONFIG.variable_prefix;
    let config = &CONFIG;
    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;

    //db.dev_clear_metadata_app_data().await?;

    loop {
        let unscanned_files = match db.get_unscanned().await {
            Ok(files) => Some(files),
            Err(e) => {
                println!("Error getting files for processing from db: {:?}", e);
                None
            }
        };
        match unscanned_files {
            Some(files) => {
                for file in files {
                    println!("Scanning {}", file.path);
                    let exifdata = match get_metadata_exiftool(&file.path).await {
                        Ok(ed) => Some(ed),
                        Err(e) => {
                            println!("Error: {}", e);
                            None
                        }
                    };

                    let clues = get_clues(&file, &exifdata).await?;
                    let metadata = Metadata { exifdata, clues };

                    //dbg!(&metadata);

                    db.update_file(&file.file_id, metadata).await?;
                }
            }
            None => {
                println!("No files to process");
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            }
        }
    }
}
