use std::{
    collections::HashMap,
    fs::{DirEntry, File, Metadata},
    io::{BufReader, Read},
    path::Path,
};

use anyhow::bail;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::{
    config::SERVER_CONFIG,
    db::DB,
    some_or_bail,
    types::{FileGroupType, FilezFile, FilezFileGroup, FilezGroups},
    utils::generate_id,
};

pub async fn scan_readonly_mounts(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    for (mount_name, mount) in &config.readonly_mount {
        let path = Path::new(&mount.path);
        if !path.exists() {
            bail!("Readonly mount path does not exist: {}", mount.path);
        }
        let file_list = recursive_read_dir(some_or_bail!(
            path.to_str(),
            "Could not convert path to str"
        ))?;
        for file in file_list {
            import_readonly_file(db, mount_name, &file, &mount.owner_id).await?;
        }
    }
    Ok(())
}

pub async fn import_readonly_file(
    db: &DB,
    mount_name: &str,
    file: &DirEntry,
    owner_id: &str,
) -> anyhow::Result<()> {
    // check if the user exists
    db.get_user_by_id(owner_id).await?;

    let path = &file.path();
    let path_str = some_or_bail!(path.to_str(), "Could not convert path to str");

    if (db.get_file_by_path(path_str).await).is_ok() {
        // file already exists
        return Ok(());
    }

    // TODO check if file has been updated since last import

    match db.get_file_group_by_name(mount_name, owner_id).await? {
        Some(_) => {}
        None => {
            // create group
            let group_id = generate_id();
            db.create_group(&FilezGroups::FilezFileGroup(FilezFileGroup {
                owner_id: owner_id.to_string(),
                name: Some(mount_name.to_string()),
                file_group_id: group_id,
                permission_ids: vec![],
                keywords: vec![],
                group_hierarchy_paths: vec![],
                mime_types: vec![],
                group_type: FileGroupType::Static,
            }))
            .await?;
        }
    }

    let file_name = some_or_bail!(
        some_or_bail!(path.file_name(), "Could not get file name").to_str(),
        "Could not convert file name to str"
    );

    let file_id = generate_id();

    let file_hash = get_file_hash(path)?;

    let mime_type = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    let metadata = file.metadata()?;
    let file_size = metadata.len();
    let app_data: HashMap<String, Value> = HashMap::new();
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    db.create_file_without_user_limits(FilezFile {
        file_id: file_id.clone(),
        mime_type,
        name: file_name.to_string(),
        owner_id: owner_id.to_string(),
        sha256: file_hash,
        storage_id: None,
        size: file_size,
        server_created: current_time,
        modified: get_modified_time_secs(&metadata),
        static_file_group_ids: vec![mount_name.to_string()],
        dynamic_file_group_ids: vec![],
        app_data,
        accessed: None,
        accessed_count: 0,
        time_of_death: None,
        created: some_or_bail!(get_created_time_secs(&metadata), "File has no created time"),
        permission_ids: vec![],
        keywords: vec![],
        path: path_str.to_string(),
        readonly: true,
    })
    .await?;

    Ok(())
}

pub fn get_modified_time_secs(metadata: &Metadata) -> Option<i64> {
    // TODO: this will fail for files older than 1970
    match metadata.modified() {
        Ok(sytem_time) => match sytem_time.duration_since(std::time::UNIX_EPOCH) {
            Ok(duration) => Some(duration.as_secs() as i64),
            Err(_) => None,
        },
        Err(_) => None,
    }
}

pub fn get_created_time_secs(metadata: &Metadata) -> Option<i64> {
    // TODO: this will fail for files older than 1970

    match metadata.modified() {
        Ok(sytem_time) => match sytem_time.duration_since(std::time::UNIX_EPOCH) {
            Ok(duration) => Some(duration.as_secs() as i64),
            Err(_) => None,
        },
        Err(_) => None,
    }
}

pub fn get_file_hash(path: &Path) -> anyhow::Result<String> {
    let input = File::open(path)?;
    let mut reader = BufReader::new(input);
    let mut hasher = Sha256::new();
    let mut buffer = [0; 1024];
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    Ok(hex::encode(hasher.finalize()))
}

pub fn recursive_read_dir(path: &str) -> anyhow::Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            entries.extend(recursive_read_dir(some_or_bail!(
                path.to_str(),
                "Could not convert path to str"
            ))?);
        } else {
            entries.push(entry);
        }
    }
    Ok(entries)
}
