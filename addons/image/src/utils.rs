use crate::config::CONFIG;
use std::path::Path;

pub fn get_folder_and_file_path(id: &str, storage_path: &str) -> (String, String) {
    let (folder, file_name) = id.split_at(3);
    let fd = folder
        .chars()
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join("/");
    (
        Path::new(storage_path)
            .join(fd)
            .to_string_lossy()
            .to_string(),
        file_name.to_string(),
    )
}

pub fn get_resolutions(width: u32, height: u32) -> Vec<u32> {
    let config = &CONFIG;
    let mut resolutions = vec![];
    for resolution in config.image.target_resolutions.iter() {
        if resolution < &width && resolution < &height {
            resolutions.push(*resolution);
        }
    }
    //resolutions.push(if height > width { height } else { width });
    resolutions
}
