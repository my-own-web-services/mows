use anyhow::bail;

use crate::api_types::FilezFile;

pub async fn get_file_infos_by_group_id(
    address: &str,
    group_id: &str,
) -> anyhow::Result<Vec<FilezFile>> {
    let res = reqwest::Client::new()
        .get(format!(
            "{}/api/get_file_infos_by_group_id/{}",
            address, group_id
        ))
        .send()
        .await?;

    let text = &res.text().await?;
    let file_infos: Vec<FilezFile> = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => bail!(
            "Failed to parse response to Vec<FilezFile>: {} got text: {}",
            e,
            text
        ),
    };
    //dbg!(&file_infos);
    Ok(file_infos)
}
