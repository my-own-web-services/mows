use anyhow::bail;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub async fn get_video_poster_amazon(
    url: &str,
    target_folder_path: &PathBuf,
) -> anyhow::Result<PathBuf> {
    fs::create_dir_all(target_folder_path)?;

    let target_path = Path::new(target_folder_path).join("video_poster.jpg");

    println!(
        "getting video poster: target_path: {}",
        target_path.display()
    );

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
