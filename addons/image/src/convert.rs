use anyhow::bail;
use image::io::Reader as ImageReader;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

use crate::{image_types::ProcessedImage, utils::get_resolutions};

pub async fn convert(
    source_path: &PathBuf,
    target_folder_path: &PathBuf,
) -> anyhow::Result<ProcessedImage> {
    let buffered_reader = match std::fs::File::open(&source_path) {
        Ok(file) => std::io::BufReader::new(file),
        Err(e) => {
            bail!("Error opening buffered reader: {}", e);
        }
    };

    // try to open the image with the mime type on the resource
    let image = match ImageReader::new(buffered_reader)
        .with_guessed_format()?
        .decode()
    {
        Ok(image) => image,
        Err(e2) => {
            bail!("Error opening image: {}", e2);
        }
    };

    let width = image.width();
    let height = image.height();

    let resolutions = get_resolutions(width, height);

    std::fs::create_dir_all(target_folder_path)?;

    for resolution in &resolutions {
        let path = Path::new(target_folder_path).join(format!("{resolution}.avif"));

        image
            .resize(
                *resolution,
                *resolution,
                image::imageops::FilterType::Lanczos3,
            )
            .save_with_format(path, image::ImageFormat::Avif)?;
    }

    Ok(ProcessedImage {
        width,
        height,
        resolutions,
    })
}

pub async fn convert_raw(
    source_path: &PathBuf,
    target_folder_path: &PathBuf,
) -> anyhow::Result<PathBuf> {
    let target_path = Path::new(target_folder_path).join("raw.jpg");

    println!("converting raw: target_path: {}", target_path.display());

    // ensure image does not exist
    std::fs::remove_file(&target_path).ok();

    let mut convert_command = Command::new("nice");
    let quality = 90;

    convert_command
        .arg("-n")
        .arg("19")
        .arg("darktable-cli")
        .arg(source_path)
        .arg(&target_path)
        .arg("--core")
        .arg("--conf")
        .arg(format!("plugins/imageio/format/jpeg/quality={}", quality));

    convert_command.spawn()?.wait()?;

    Ok(target_path)
}
