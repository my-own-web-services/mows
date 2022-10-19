use crate::api_types::SetAppDataRequest;
use anyhow::bail;

pub async fn set_app_data(address: &str, app_data_req: &SetAppDataRequest) -> anyhow::Result<()> {
    let res = reqwest::Client::new()
        .post(format!("{}/set_app_data/", address))
        .body(serde_json::to_string(app_data_req)?)
        .send()
        .await?;

    if !res.status().is_success() {
        bail!("Failed to set app data: {}", res.text().await?)
    }

    Ok(())
}
