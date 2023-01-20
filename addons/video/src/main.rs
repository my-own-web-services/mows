use mongodb::options::ClientOptions;
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;
use video::{convert::convert, db::DB};

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let db = DB::new(ClientOptions::parse("mongodb://root:root@localhost:27017").await?).await?;
    let source_path = "/mnt/archive/Video/RawDLYT/Polizei verhaftet Kind ¦ Alles In Ordnung.mp4";
    convert(source_path, "./tests/", "foo").await?;

    Ok(())
}
