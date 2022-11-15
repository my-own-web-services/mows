use anyhow::bail;

use crate::api_types::FilezUser;

pub async fn get_user_info(address: &str) -> anyhow::Result<FilezUser> {
    let res = reqwest::Client::new()
        .get(format!("{}/api/get_user_info/", address))
        .send()
        .await?;

    let text = res.text().await?;

    let user: FilezUser = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => bail!(
            "Failed to parse response to FilezUser: {} got text: {}",
            e,
            text
        ),
    };

    Ok(user)
}
