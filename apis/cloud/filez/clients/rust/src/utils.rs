use crate::client::ApiClient;
use anyhow::Context;
use futures::StreamExt;
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

pub async fn stream_file_to_path(
    filez_client: &ApiClient,
    file_id: Uuid,
    file_version_number: u32,
    target_path: &PathBuf,
) -> Result<String, anyhow::Error> {
    if !target_path.exists() {
        tokio::fs::create_dir_all(&target_path.parent().unwrap()).await?;
    }

    let get_file_version_content_request = filez_client
        .get_file_version_content(file_id, Some(file_version_number), None, None, false, 0)
        .await
        .context("Failed to get file version content")?;

    let source_mime_type = get_file_version_content_request
        .headers()
        .get("Content-Type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let mut stream = get_file_version_content_request.bytes_stream();

    let mut file = tokio::fs::File::create(&target_path).await?;
    while let Some(chunk) = stream.next().await {
        file.write_all(&chunk.map_err(|e| anyhow::Error::new(e))?)
            .await?;
    }
    file.flush().await?;

    Ok(source_mime_type)
}
