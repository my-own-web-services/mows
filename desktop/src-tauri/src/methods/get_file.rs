use anyhow::bail;
use futures::StreamExt;
use tokio::io::AsyncWriteExt;

pub async fn get_file(address: &str, file_id: &str, file_path: &str) -> anyhow::Result<()> {
    let res = reqwest::Client::new()
        .get(format!("{}/get_file/{}", address, file_id))
        .send()
        .await?;

    if !res.status().is_success() {
        bail!("Failed to get file")
    }

    let mut file = tokio::fs::File::create(file_path).await?;
    // stream the body into the file
    let mut stream = res.bytes_stream();
    while let Some(item) = stream.next().await {
        file.write_all(&item?).await?;
    }

    Ok(())
}
