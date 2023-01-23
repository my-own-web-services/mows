use crate::{config::CONFIG, utils::get_folder_and_file_path};

pub async fn convert(
    source_path: &str,
    storage_path: &str,
    file_id: &str,
    resolutions: &Vec<u32>,
) -> anyhow::Result<()> {
    let config = &CONFIG;
    let image = image::open(source_path)?;

    let (folder_path, file_name) = get_folder_and_file_path(file_id, storage_path);

    let path = format!("{folder_path}/{file_name}/");

    std::fs::create_dir_all(&path)?;

    for resolution in resolutions {
        let path = format!("{path}{resolution}.avif");

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
