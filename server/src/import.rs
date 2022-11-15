use crate::{
    config::{ImportFolder, SERVER_CONFIG},
    db::DB,
    some_or_bail,
    types::FilezFile,
    utils::{
        generate_id, get_created_time_secs, get_folder_and_file_path, get_modified_time_secs,
        get_sha256_digest_of_file, recursive_read_dir,
    },
};
use anyhow::bail;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs::{self, File},
};

pub async fn import_local_folders(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    let import_folders = &config.auto_import.folders;
    for import_folder in import_folders {
        import_local_folder(db, import_folder).await?;
    }

    Ok(())
}

pub async fn import_local_folder(db: &DB, import_folder: &ImportFolder) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    let files = recursive_read_dir(&import_folder.from_path)?;
    for file in files {
        let file_path = file.path();
        let local_file_path_string =
            some_or_bail!(file_path.to_str(), "Could not convert file_path to string").to_string();
        // TODO check if file is already in db and skip if it is

        let file_id = generate_id();
        let mime_type = mime_guess::from_path(&file_path)
            .first_or_octet_stream()
            .to_string();
        let name = some_or_bail!(
            some_or_bail!(file_path.file_name(), "File name is None").to_str(),
            "could not convert file name to str"
        )
        .to_string();
        let current_time = chrono::offset::Utc::now().timestamp_millis();
        let app_data: HashMap<String, Value> = HashMap::new();

        let disk_file = File::open(&file_path)?;
        let meta = disk_file.metadata()?;
        let modified_time = get_modified_time_secs(&meta);
        let created_time = get_created_time_secs(&meta);
        let size = meta.len();
        let hash = get_sha256_digest_of_file(&disk_file)?;

        match import_folder.move_files {
            true => {
                let storage_id = some_or_bail!(
                    &import_folder.storage_id,
                    "Storage id must be provided when moving files"
                );
                let storage_path = some_or_bail!(
                    config.storage.get(storage_id),
                    format!(
                        "Storage name: '{}' is missing specifications on the user entry",
                        storage_id
                    )
                )
                .path
                .clone();

                let (folder_path, file_name) = get_folder_and_file_path(&file_id, &storage_path);

                fs::create_dir_all(&folder_path)?;
                let new_file_path = format!("{}/{}", folder_path, file_name);
                let cft = db
                    .create_file(FilezFile {
                        file_id: file_id.clone(),
                        mime_type,
                        name,
                        owner_id: import_folder.user_id.clone(),
                        sha256: hash.clone(),
                        storage_id: import_folder.storage_id.clone(),
                        size,
                        server_created: current_time,
                        modified: modified_time,
                        static_file_group_ids: vec![],
                        dynamic_file_group_ids: vec![],
                        app_data,
                        accessed: None,
                        accessed_count: 0,
                        time_of_death: None,
                        created: created_time.unwrap_or(current_time),
                        permission_ids: vec![],
                        keywords: vec![],
                        path: new_file_path.clone(),
                    })
                    .await;
                match cft {
                    Ok(_) => match fs::rename(local_file_path_string, new_file_path) {
                        Ok(_) => {}
                        Err(e) => {
                            //TODO: delete file from db
                            bail!("Could not move file: {}", e)
                        }
                    },
                    Err(e) => bail!("Could not create file: {}", e),
                }
            }
            false => {
                db.create_file(FilezFile {
                    file_id: file_id.clone(),
                    mime_type,
                    name,
                    owner_id: import_folder.user_id.clone(),
                    sha256: hash.clone(),
                    storage_id: import_folder.storage_id.clone(),
                    size,
                    server_created: current_time,
                    modified: modified_time,
                    static_file_group_ids: vec![],
                    dynamic_file_group_ids: vec![],
                    app_data,
                    accessed: None,
                    accessed_count: 0,
                    time_of_death: None,
                    created: created_time.unwrap_or(current_time),
                    permission_ids: vec![],
                    keywords: vec![],
                    path: local_file_path_string,
                })
                .await?;
            }
        }
    }

    Ok(())
}
