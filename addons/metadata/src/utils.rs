use std::path::Path;

use crate::metadata_types::Metadata;

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

pub fn has_poster(data: &Metadata) -> bool {
    if let Some(external) = &data.external {
        if let Some(omdb) = &external.omdb {
            if omdb.poster.is_some() {
                return true;
            }
        }
    }
    false
}
