use crate::metadata_types::MetadataResult;
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

pub fn has_poster(metadata_result: &MetadataResult) -> bool {
    if let Some(external) = &metadata_result.external {
        if let Some(omdb) = &external.omdb {
            if omdb.poster.is_some() {
                return true;
            }
        }
    }

    false
}
