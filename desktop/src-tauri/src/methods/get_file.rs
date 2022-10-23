use std::path::Path;

use anyhow::bail;
use futures::StreamExt;
use tokio::io::AsyncWriteExt;

pub async fn get_file(
    address: &str,
    file_id: &str,
    maybe_file_path: Option<String>,
    local_folder: &str,
) -> anyhow::Result<()> {
    let res = reqwest::Client::new()
        .get(format!("{}/get_file/{}", address, file_id))
        .send()
        .await?;

    if !res.status().is_success() {
        bail!("Failed to get file")
    }

    let path = Path::new(local_folder).join(maybe_file_path.unwrap_or_else(|| file_id.to_string()));

    // TODO save this first to another file and then rename it to the final name
    let mut file = tokio::fs::File::create(path).await?;
    // stream the body into the file
    let mut stream = res.bytes_stream();
    while let Some(item) = stream.next().await {
        file.write_all(&item?).await?;
    }

    Ok(())
}
