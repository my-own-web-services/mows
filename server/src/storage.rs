use crate::{config::SERVER_CONFIG, types::FilezFile, utils::get_folder_and_file_path};
use anyhow::bail;
use std::path::Path;

pub struct StorageLocations {
    pub full_path: String,
    pub folder_path: String,
    pub file_name: String,
}

pub struct AppDataStorageLocation {
    pub file_folder: String,
}

pub fn get_storage_location_from_file(file: &FilezFile) -> anyhow::Result<StorageLocations> {
    let config = &SERVER_CONFIG;

    let storage_id = match &file.storage_id {
        Some(v) => v,
        None => &config.storage.default_storage,
    };

    let storage = match config.storage.storages.get(storage_id) {
        Some(sp) => sp,
        None => bail!("Storage not found"),
    };

    match &file.readonly {
        true => Ok(StorageLocations {
            full_path: file.readonly_path.clone().unwrap(),
            folder_path: file.readonly_path.clone().unwrap().replace(&file.name, ""),
            file_name: file.name.clone(),
        }),
        false => {
            let (folder_path, file_name) = get_folder_and_file_path(&file.file_id, &storage.path);
            let full_path = format!("{}/{}", folder_path, file_name);

            dbg!(&folder_path, &file_name, &full_path);

            Ok(StorageLocations {
                folder_path,
                file_name: file_name.to_string(),
                full_path,
            })
        }
    }
}

pub fn get_future_storage_location(
    file_id: &str,
    storage_id: Option<&str>,
) -> anyhow::Result<StorageLocations> {
    let config = &SERVER_CONFIG;

    let storage_id = storage_id.unwrap_or(&config.storage.default_storage);

    let storage = match config.storage.storages.get(storage_id) {
        Some(sp) => sp,
        None => bail!("Storage not found"),
    };

    let (folder_path, file_name) = get_folder_and_file_path(file_id, &storage.path);
    let full_path = format!("{}/{}", folder_path, file_name);

    Ok(StorageLocations {
        folder_path,
        file_name,
        full_path,
    })
}

pub fn get_app_data_folder_for_file(
    file: &FilezFile,
    app_id: &str,
) -> anyhow::Result<AppDataStorageLocation> {
    let config = &SERVER_CONFIG;

    let storage_id = match &file.storage_id {
        Some(v) => v,
        None => &config.storage.default_storage,
    };

    let storage = match config.storage.storages.get(storage_id) {
        Some(sp) => sp,
        None => bail!("Storage not found"),
    };

    let app_data_storage = match storage.app_storage.get(app_id) {
        Some(ads) => ads,
        None => bail!("App data storage not found"),
    };

    let (folder_path, file_name) = get_folder_and_file_path(&file.file_id, &storage.path);
    let file_folder = Path::new(&app_data_storage.path)
        .join(folder_path)
        .join(file_name)
        .to_string_lossy()
        .into_owned();

    Ok(AppDataStorageLocation { file_folder })
}
