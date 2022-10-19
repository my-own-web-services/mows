use crate::api_types::FilezUser;

pub async fn get_user_info(address: &str) -> anyhow::Result<FilezUser> {
    let res = reqwest::Client::new()
        .get(format!("{}/get_user_info/", address))
        .send()
        .await?;

    let text = res.text().await?;
    dbg!(&text);

    let user: FilezUser = serde_json::from_str(&text)?;

    Ok(user)
}
