use super::types::StorageConfig;
use crate::server::FilezFile;
use anyhow::bail;
use std::path::{Path, PathBuf};

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct StorageLocations {
    pub full_path: PathBuf,
    pub folder_path: PathBuf,
    pub file_name: String,
}
#[derive(Debug, Eq, PartialEq, Clone)]
pub struct AppDataStorageLocation {
    pub file_folder: PathBuf,
}

pub fn get_storage_location_from_file(
    storage_config: &StorageConfig,
    file: &FilezFile,
) -> anyhow::Result<StorageLocations> {
    let storage_id = match &file.storage_id {
        Some(v) => v,
        None => &storage_config.default_storage,
    };

    let storage = match storage_config.storages.get(storage_id) {
        Some(sp) => sp,
        None => bail!("Storage not found"),
    };

    match &file.readonly {
        true => Ok(StorageLocations {
            full_path: Path::new(&file.readonly_path.clone().unwrap()).to_path_buf(),
            folder_path: Path::new(&file.readonly_path.clone().unwrap().replace(&file.name, ""))
                .to_path_buf(),
            file_name: file.name.clone(),
        }),
        false => {
            let (folder_path, file_name) = get_folder_and_file_path(&file.file_id, &storage.path);
            let full_path = Path::new(&folder_path).join(&file_name);

            //dbg!(&folder_path, &file_name, &full_path);

            Ok(StorageLocations {
                folder_path,
                file_name: file_name.to_string(),
                full_path,
            })
        }
    }
}

pub fn get_future_storage_location(
    storage_config: &StorageConfig,
    file_id: &str,
    storage_id: Option<&str>,
) -> anyhow::Result<StorageLocations> {
    let storage_id = storage_id.unwrap_or(&storage_config.default_storage);

    let storage = match storage_config.storages.get(storage_id) {
        Some(sp) => sp,
        None => bail!("Storage not found"),
    };

    let (folder_path, file_name) = get_folder_and_file_path(file_id, &storage.path);
    let full_path = Path::new(&folder_path).join(&file_name);

    Ok(StorageLocations {
        folder_path,
        file_name,
        full_path,
    })
}

pub fn get_app_data_folder_for_file(
    storage_config: &StorageConfig,
    file: &FilezFile,
    app_id: &str,
) -> anyhow::Result<AppDataStorageLocation> {
    let storage_id = match &file.storage_id {
        Some(v) => v,
        None => &storage_config.default_storage,
    };

    let storage = match storage_config.storages.get(storage_id) {
        Some(s) => s,
        None => bail!("Storage with storage_id: {storage_id} not found"),
    };

    let app_data_storage = match storage.app_storage.get(app_id) {
        Some(ads) => ads,
        None => bail!("App data storage for app_id: {app_id} not found"),
    };

    let (folder_path, file_name) = get_folder_and_file_path(&file.file_id, &app_data_storage.path);
    let file_folder = Path::new(&app_data_storage.path)
        .join(folder_path)
        .join(file_name);

    Ok(AppDataStorageLocation { file_folder })
}

pub fn get_folder_and_file_path(id: &str, storage_path: &PathBuf) -> (PathBuf, String) {
    let (folder, file_name) = id.split_at(3);
    let fd = folder
        .chars()
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join("/");
    (Path::new(storage_path).join(fd), file_name.to_string())
}
