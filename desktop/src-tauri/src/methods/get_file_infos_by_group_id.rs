use crate::api_types::FilezFile;

pub async fn get_file_infos_by_group_id(
    address: &str,
    group_id: &str,
) -> anyhow::Result<Vec<FilezFile>> {
    let res = reqwest::Client::new()
        .get(format!(
            "{}/get_file_infos_by_group_id/{}",
            address, group_id
        ))
        .send()
        .await?;

    let file_infos: Vec<FilezFile> = serde_json::from_str(&res.text().await?)?;

    Ok(file_infos)
}
