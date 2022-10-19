use anyhow::bail;

pub async fn delete_file(address: &str, file_id: &str) -> anyhow::Result<()> {
    let res = reqwest::Client::new()
        .post(format!("{}/delete_file/{}", address, file_id))
        .send()
        .await?;

    if !res.status().is_success() {
        bail!("Failed to delete file: {}", res.text().await?)
    }
    Ok(())
}
