use crate::utils::get_folder_and_file_path;
use std::process::Command;

pub async fn convert(
    source_path: &str,
    storage_path: &str,
    file_id: &str,
    resolutions: &Vec<u32>,
) -> anyhow::Result<()> {
    let image = image::open(source_path)?;

    let (folder_path, file_name) = get_folder_and_file_path(file_id, storage_path);

    let target_path = format!("{folder_path}/{file_name}/");

    std::fs::create_dir_all(&target_path)?;

    for resolution in resolutions {
        let path = format!("{target_path}{resolution}.avif");

        image
            .resize(
                *resolution,
                *resolution,
                image::imageops::FilterType::Lanczos3,
            )
            .save_with_format(path, image::ImageFormat::Avif)?;
    }

    Ok(())
}

pub async fn convert_raw(
    source_path: &str,
    storage_path: &str,
    file_id: &str,
) -> anyhow::Result<String> {
    let (folder_path, file_name) = get_folder_and_file_path(file_id, storage_path);

    let target_path = format!("{folder_path}/{file_name}/i.jpg");
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
