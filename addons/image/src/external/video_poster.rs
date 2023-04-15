use crate::utils::get_folder_and_file_path;
use anyhow::bail;
use std::{fs, io::Write};

pub async fn get_video_poster_amazon(
    url: &str,
    storage_path: &str,
    file_id: &str,
) -> anyhow::Result<String> {
    let (folder_path, file_name) = get_folder_and_file_path(file_id, storage_path);

    fs::create_dir_all(format!("{folder_path}/{file_name}"))?;

    let target_path = format!("{folder_path}/{file_name}/video_poster.jpg");

    let try_full_res_response = reqwest::get(url.replace("SX300", "SX1000")).await?;

    let response = if try_full_res_response.status().is_success() {
        try_full_res_response
    } else {
        let r = reqwest::get(url).await?;
        if r.status().is_success() {
            r
        } else {
            bail!("Could not get video poster from Amazon: {}", r.status());
        }
    };

    let mut file = std::fs::File::create(&target_path)?;
    file.write_all(&response.bytes().await?)?;

    Ok(target_path)
}
