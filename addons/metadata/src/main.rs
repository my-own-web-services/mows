use metadata::{db::DB, exiftool::get_metadata_exiftool};
use mongodb::options::ClientOptions;
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let db = DB::new(ClientOptions::parse("mongodb://root:root@localhost:27017").await?).await?;

    let files = db.get_unscanned().await?;

    for file in files {
        let data = get_metadata_exiftool(&file.path).await?;
        db.update_file(&file.file_id, data).await?;
    }

    Ok(())
}
