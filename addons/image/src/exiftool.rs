use crate::convert::convert;
use crate::image_types::ProcessedImage;
use crate::utils::get_resolutions;
use crate::{config::CONFIG, some_or_bail, utils::get_folder_and_file_path};
use anyhow::bail;
use anyhow::Ok;
use serde_json::Value;
use std::{collections::HashMap, io::Write, process::Command};

pub async fn get_metadata_exiftool(path: &str) -> anyhow::Result<HashMap<String, Value>> {
    let output = Command::new("./Image-ExifTool-12.55/exiftool")
        .arg(path)
        .arg("-json")
        .arg("-stay_open")
        .output()?;

    let parsed: Vec<HashMap<String, Value>> =
        serde_json::from_str(&String::from_utf8_lossy(&output.stdout))?;

    let mut map = parsed[0].clone();

    match map.get("Error") {
        Some(e) => bail!("{}", e),
        None => {
            let rm = vec!["FilePermissions", "Directory", "SourceFile", "FileName"];
            for k in rm {
                map.remove(k);
            }
            Ok(map)
        }
    }
}

pub async fn extract_album_art(file_path: &str, file_id: &str) -> anyhow::Result<ProcessedImage> {
    let config = &CONFIG;

    let exif_data = get_metadata_exiftool(file_path).await?;

    let (file_extension, mime_type) = match exif_data.get("PictureMIMEType") {
        Some(e) => match e.to_string().as_str() {
            "\"image/jpeg\"" => ("jpg", "image/jpeg"),
            "\"image/png\"" => ("png", "image/png"),
            _ => bail!("Unknown PictureMIMEType"),
        },
        None => bail!("FileTypeExtension not found"),
    };

    let (folder_path, file_name) = get_folder_and_file_path(file_id, &config.storage_path);
    let path = format!("{folder_path}/{file_name}/");

    std::fs::create_dir_all(&path)?;

    let output = Command::new("./Image-ExifTool-12.55/exiftool")
        .arg(file_path)
        .arg("-b")
        .arg("-Picture")
        .output()?;

    let output_path = format!("{path}i.{file_extension}");

    let mut file = std::fs::File::create(&output_path)?;
    file.write_all(&output.stdout)?;

    let thumbnail_metadata_command = Command::new("./Image-ExifTool-12.55/exiftool")
        .arg(&output_path)
        .arg("-json")
        .output()?;

    let thumbnail_metadata: Vec<HashMap<String, Value>> =
        serde_json::from_str(&String::from_utf8_lossy(&thumbnail_metadata_command.stdout))?;

    if thumbnail_metadata.is_empty() {
        bail!("No thumbnail metadata found");
    }

    let thumbnail_metadata = thumbnail_metadata[0].clone();
    let width = some_or_bail!(thumbnail_metadata.get("ImageWidth"), "ImageWidth not found")
        .to_string()
        .parse::<u32>()?;
    let height = some_or_bail!(
        thumbnail_metadata.get("ImageHeight"),
        "ImageHeight not found"
    )
    .to_string()
    .parse::<u32>()?;

    // dont create images that are larger than the source
    let resolutions = get_resolutions(width, height);

    convert(&output_path, &config.storage_path, file_id, &resolutions).await?;
    tokio::fs::remove_file(&output_path).await?;

    Ok(ProcessedImage {
        width,
        height,
        resolutions,
    })
}
