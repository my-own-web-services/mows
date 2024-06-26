use crate::{config::SERVER_CONFIG, db::DB, some_or_bail, utils::generate_id};
use anyhow::bail;
use filez_common::{
    server::{
        file::FilezFile,
        file_group::{FileGroupType, FilezFileGroup},
        user::FilezUser,
    },
    storage::types::ReadonlyConfig,
};
use indicatif::ProgressBar;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{DirEntry, File, Metadata},
    io::{self},
    path::{Path, PathBuf},
};

pub async fn scan_readonly_mounts(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    for (mount_name, storage) in &config.storage.storages {
        if let Some(roc) = &storage.readonly {
            match scan_readonly_mount(db, mount_name, &storage.path, roc).await {
                Ok(_) => {
                    println!("Success")
                }
                Err(e) => {
                    println!("Failed: {e}")
                }
            }
        }
    }
    Ok(())
}

pub async fn scan_readonly_mount(
    db: &DB,
    mount_name: &str,
    storage_path: &PathBuf,
    mount: &ReadonlyConfig,
) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    print!("Scanning {}: ", mount_name);

    let path = Path::new(storage_path);
    if !path.exists() {
        bail!(
            "Readonly mount path does not exist: {}",
            storage_path.display()
        );
    }
    let file_list = recursive_read_dir(some_or_bail!(
        path.to_str(),
        "Could not convert path to str"
    ))?;

    // check if the user exists
    let user = match db.get_user_by_email(&mount.owner_email).await? {
        Some(v) => v,
        None => {
            println!("User does not exist: {}", mount.owner_email);
            println!("Creating Disabled user");

            let user = FilezUser::new(
                &config.storage,
                None,
                Some(mount.owner_email.to_string()),
                None,
            );

            db.create_users(&vec![user.clone()]).await?;

            match db.get_user_by_id(&user.user_id).await? {
                Some(v) => v,
                None => {
                    bail!("User does not exist after creation");
                }
            }
        }
    };

    let file_groups = db
        .get_file_groups_by_name(mount_name, &user.user_id)
        .await?;

    #[allow(clippy::comparison_chain)]
    let group_id = if file_groups.len() > 1 {
        bail!("More than one file group with the same name exists");
    } else if file_groups.len() == 1 {
        some_or_bail!(file_groups.get(0), "what the...")
            .file_group_id
            .clone()
    } else {
        // create group
        let mut file_group =
            FilezFileGroup::new(&user, FileGroupType::Static, Some(mount_name.to_string()));

        file_group.make_readonly();
        file_group.make_undeleatable();

        db.create_file_group(&file_group).await?;

        file_group.file_group_id.clone()
    };

    let file_bar = ProgressBar::new(file_list.len() as u64);
    //bars.add(file_bar);
    file_bar.inc(1);
    for file in file_list {
        file_bar.inc(1);
        import_readonly_file(db, &file, mount_name, &user.user_id, &group_id).await?;
    }
    Ok(())
}

pub async fn import_readonly_file(
    db: &DB,
    file: &DirEntry,
    mount_name: &str,
    owner_id: &str,
    group_id: &str,
) -> anyhow::Result<()> {
    let path = &file.path();
    let path_str = some_or_bail!(path.to_str(), "Could not convert path to str");

    let file_name = some_or_bail!(
        some_or_bail!(path.file_name(), "Could not get file name").to_str(),
        "Could not convert file name to str"
    );

    if (db.get_file_by_readonly_path(path_str).await?).is_some() {
        // file already exists
        return Ok(());
    }

    // TODO check if file has been updated since last import

    let file_id = generate_id(16);

    // TODO enable it optional
    //let file_hash = get_file_hash(path)?;

    let mime_type = mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string();
    let metadata = file.metadata()?;
    let file_size = metadata.len();
    let app_data: HashMap<String, Value> = HashMap::new();
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    let all_group = db.get_users_all_file_group(owner_id).await?;

    db.create_file(
        FilezFile {
            file_id: file_id.clone(),
            mime_type,
            name: file_name.to_string(),
            owner_id: owner_id.to_string(),
            pending_new_owner_id: None,
            sha256: None,
            storage_id: Some(mount_name.to_string()),
            size: file_size,
            server_created: current_time,
            modified: Some(get_modified_time_secs(&metadata) * 1000),
            static_file_group_ids: vec![group_id.to_string(), all_group.file_group_id.clone()],
            dynamic_file_group_ids: vec![],
            app_data,
            accessed: None,
            accessed_count: 0,
            time_of_death: None,
            created: get_created_time_secs(&metadata)
                .map(|o| o * 1000)
                .unwrap_or(current_time),
            permission_ids: vec![],
            keywords: vec![],
            readonly: true,
            readonly_path: Some(path_str.to_string()),
            linked_files: vec![],
            manual_group_sortings: HashMap::new(),
            sub_type: None,
        },
        true,
    )
    .await?;

    Ok(())
}

pub fn get_modified_time_secs(metadata: &Metadata) -> i64 {
    filetime::FileTime::from_last_modification_time(metadata).unix_seconds()
}

pub fn get_created_time_secs(metadata: &Metadata) -> Option<i64> {
    filetime::FileTime::from_creation_time(metadata).map(|o| o.unix_seconds())
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
