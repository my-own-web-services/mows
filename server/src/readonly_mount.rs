use crate::{
    config::SERVER_CONFIG,
    db::DB,
    some_or_bail,
    types::{FileGroupType, FilezFile, FilezFileGroup, FilezGroups},
    utils::generate_id,
};
use anyhow::bail;
use indicatif::ProgressBar;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{DirEntry, File, Metadata},
    io::{self},
    path::Path,
};

pub async fn scan_readonly_mounts(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    //let bars = MultiProgress::new();

    for (mount_name, mount) in &config.readonly_mount {
        println!("Scanning {}", mount_name);
        let path = Path::new(&mount.path);
        if !path.exists() {
            bail!("Readonly mount path does not exist: {}", mount.path);
        }
        let file_list = recursive_read_dir(some_or_bail!(
            path.to_str(),
            "Could not convert path to str"
        ))?;

        // check if the user exists
        let user = db.get_user_by_id(&mount.owner_id).await?;
        if user.is_none() {
            bail!("User does not exist: {}", mount.owner_id);
        }

        let file_groups = db
            .get_file_groups_by_name(mount_name, &mount.owner_id)
            .await?;

        #[allow(clippy::comparison_chain)]
        let group_id = if file_groups.len() > 1 {
            bail!("More than one file group with the same name exists");
        } else if file_groups.len() == 1 {
            file_groups[0].file_group_id.clone()
        } else {
            // create group
            let group_id = generate_id();
            db.create_group(&FilezGroups::FilezFileGroup(FilezFileGroup {
                owner_id: mount.owner_id.to_string(),
                name: Some(mount_name.to_string()),
                file_group_id: group_id.clone(),
                permission_ids: vec![],
                keywords: vec![],
                group_hierarchy_paths: vec![],
                mime_types: vec![],
                group_type: FileGroupType::Static,
                item_count: 0,
            }))
            .await?;
            group_id
        };

        let file_bar = ProgressBar::new(file_list.len() as u64);
        //bars.add(file_bar);
        file_bar.inc(1);
        for file in file_list {
            file_bar.inc(1);
            import_readonly_file(db, &file, &mount.owner_id, &group_id).await?;
        }
        // checkmark emoji
    }
    Ok(())
}

pub async fn import_readonly_file(
    db: &DB,
    file: &DirEntry,
    owner_id: &str,
    group_id: &str,
) -> anyhow::Result<()> {
    let path = &file.path();
    let path_str = some_or_bail!(path.to_str(), "Could not convert path to str");

    if (db.get_file_by_path(path_str).await?).is_some() {
        // file already exists
        return Ok(());
    }

    // TODO check if file has been updated since last import

    let file_name = some_or_bail!(
        some_or_bail!(path.file_name(), "Could not get file name").to_str(),
        "Could not convert file name to str"
    );

    let file_id = generate_id();

    // TODO enable it optional
    //let file_hash = get_file_hash(path)?;

    let mime_type = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    let metadata = file.metadata()?;
    let file_size = metadata.len();
    let app_data: HashMap<String, Value> = HashMap::new();
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    db.create_file(
        FilezFile {
            file_id: file_id.clone(),
            mime_type,
            name: file_name.to_string(),
            owner_id: owner_id.to_string(),
            pending_new_owner_id: None,
            sha256: None,
            storage_id: None,
            size: file_size,
            server_created: current_time,
            modified: get_modified_time_secs(&metadata),
            static_file_group_ids: vec![group_id.to_string()],
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
        },
        true,
    )
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
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    io::copy(&mut file, &mut hasher)?;

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
