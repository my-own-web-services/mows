use crate::convert::convert;
use crate::image_types::ProcessedImage;
use crate::some_or_bail;
use crate::utils::get_resolutions;
use anyhow::bail;
use anyhow::Ok;
use serde_json::Value;
use std::path::Path;
use std::path::PathBuf;
use std::{collections::HashMap, io::Write, process::Command};

pub async fn get_metadata_exiftool(path: &PathBuf) -> anyhow::Result<HashMap<String, Value>> {
    let output = Command::new("./Image-ExifTool-12.55/exiftool")
        .arg(path)
        .arg("-struct")
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

pub async fn extract_album_art(
    source_path: &PathBuf,
    target_folder_path: &PathBuf,
) -> anyhow::Result<ProcessedImage> {
    let exif_data = get_metadata_exiftool(source_path).await?;

    let (file_extension, mime_type) = match exif_data.get("PictureMIMEType") {
        Some(e) => match e.to_string().as_str() {
            "\"image/jpeg\"" => ("jpg", "image/jpeg"),
            "\"image/png\"" => ("png", "image/png"),
            _ => bail!("Unknown PictureMIMEType"),
        },
        None => bail!("FileTypeExtension not found"),
    };

    std::fs::create_dir_all(target_folder_path)?;

    let output = Command::new("./Image-ExifTool-12.55/exiftool")
        .arg(source_path)
        .arg("-b")
        .arg("-Picture")
        .output()?;

    let output_path = Path::new(target_folder_path).join(format!("i.{file_extension}"));

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

    convert(&output_path, target_folder_path).await?;
    tokio::fs::remove_file(&output_path).await?;

    Ok(ProcessedImage {
        width,
        height,
        resolutions,
    })
}
