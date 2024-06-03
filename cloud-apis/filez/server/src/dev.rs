use crate::{
    config::SERVER_CONFIG, db::DB, internal_types::GetItemListRequestBody, some_or_bail,
    utils::generate_id,
};
use anyhow::bail;
use filez_common::{
    server::{
        file::FilezFile,
        file_group::{FileGroupType, FilezFileGroup},
        user::{FilezUser, UserStatus, UserVisibility},
    },
    storage::index::{get_future_storage_location, get_storage_location_from_file},
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, vec};

pub async fn dev(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    if config.dev.create_mock_users {
        create_mock_users(db).await?;
    }

    if !config.users.create.is_empty() {
        create_users(db).await?;
    }

    if let Some(create_mock_files_limit) = &config.dev.create_mock_file_entries_until_reached_limit
    {
        println!("Creating mock files");
        create_mock_file_entries(db, *create_mock_files_limit).await?;
    }

    if config.dev.check_database_consistency_on_startup {
        match check_database_consistency(db).await {
            Ok(_) => println!("Database consistency check passed: Everything is fine!"),
            Err(e) => println!("Database consistency check failed: {}", e),
        }
    }

    Ok(())
}

pub async fn create_mock_file_entries(db: &DB, create_mock_files_limit: u32) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    let current_files = db.get_total_ammount_of_files().await?;

    let email = some_or_bail!(
        &config.dev.mock_files_owner_email,
        "No mock files owner email set"
    );

    let owner = some_or_bail!(
        db.get_user_by_email(email).await?,
        "No user found with email"
    );

    let all_group = db.get_users_all_file_group(&owner.user_id).await?;

    let mut files = vec![];

    let storage_id: String = config.storage.default_storage.clone();

    let files_to_create = some_or_bail!(
        create_mock_files_limit.checked_sub(current_files.try_into()?),
        "No files to create"
    );

    println!(
        "Creating {} mock files for user with id: {}",
        files_to_create, owner.user_id
    );

    let now = chrono::Utc::now().timestamp_millis();

    let group_id = {
        let groups = db
            .get_file_groups_by_name("mock_files", &owner.user_id)
            .await?;

        match groups.first() {
            Some(g) => g.file_group_id.clone(),
            None => {
                let mut fg = FilezFileGroup::new(
                    &owner,
                    FileGroupType::Static,
                    Some("mock_files".to_string()),
                );
                fg.make_readonly();
                db.create_file_group(&fg).await?;
                fg.file_group_id
            }
        }
    };

    let static_file_group_ids = vec![group_id, all_group.file_group_id.clone()];

    for _ in 0..files_to_create {
        let file_id = generate_id(16);

        let size = rand::random::<u8>();

        let file = FilezFile {
            file_id: file_id.clone(),
            mime_type: "text/plain".to_string(),
            name: generate_id(16),
            owner_id: owner.user_id.clone(),
            pending_new_owner_id: None,
            sha256: None,
            storage_id: Some(storage_id.clone()),
            size: size.into(),
            server_created: now,
            created: now,
            modified: None,
            accessed: None,
            accessed_count: 0,
            static_file_group_ids: static_file_group_ids.clone(),
            dynamic_file_group_ids: vec![],
            manual_group_sortings: HashMap::new(),
            time_of_death: None,
            app_data: HashMap::new(),
            permission_ids: vec![],
            keywords: vec![],
            readonly: false,
            readonly_path: None,
            linked_files: vec![],
            sub_type: None,
        };

        files.push(file);
    }

    if files.is_empty() {
        return Ok(());
    }

    let chunk_limit = 10000;

    for (index, chunk) in files.chunks(chunk_limit).enumerate() {
        println!("Creating chunk {}/{}", index, files.len() / chunk_limit);
        db.create_many_mock_files(
            chunk.to_vec(),
            static_file_group_ids.clone(),
            &owner.user_id,
            &storage_id,
        )
        .await?;
        for file in chunk {
            let file_id = &file.file_id;
            let future_storage_location =
                get_future_storage_location(&config.storage, file_id, Some(&storage_id))?;

            fs::create_dir_all(&future_storage_location.folder_path)?;

            fs::write(
                &future_storage_location.full_path,
                generate_id(file.size.try_into().unwrap()),
            )?;
        }
    }

    Ok(())
}

pub async fn create_mock_users(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    let mock_users_string = match tokio::fs::read_to_string(&config.dev.mock_user_path).await {
        Ok(file) => file,
        Err(e) => {
            bail!("Mock user file not found: {e}");
        }
    };
    let mock_users: Vec<MockUser> = serde_yaml::from_str(&mock_users_string)?;

    let mut new_users = vec![];
    for mock_user in mock_users {
        if db.get_user_by_email(&mock_user.email).await?.is_none() {
            let mut user = FilezUser::new(
                &config.storage,
                Some(mock_user.name),
                Some(mock_user.email.clone()),
                None,
            );
            user.set_visibility(UserVisibility::Public);
            user.set_status(mock_user.status);
            new_users.push(user)
        }
    }
    if new_users.is_empty() {
        return Ok(());
    }

    let res = db.create_users(&new_users).await;
    if res.is_err() {
        println!("Error creating mock user: {:#?}", res);
    }

    Ok(())
}

pub async fn check_database_consistency(db: &DB) -> anyhow::Result<()> {
    println!("Checking group file count vs actual file count consistency");
    check_group_file_count_consistency(db).await?;
    println!("Checking user storage use vs actual storage use consistency");
    check_storage_use_consistency(db).await?;
    println!("Checking database file existence vs actual file existence");
    check_database_file_storage_consistency(db).await?;

    Ok(())
}

pub async fn check_dangling_references(db: &DB) -> anyhow::Result<()> {
    println!("Checking dangling file group references");
    check_dangling_file_group_references(db).await?;
    println!("Checking dangling permission references");
    check_dangling_permission_references(db).await?;
    Ok(())
}

pub async fn check_dangling_file_group_references(db: &DB) -> anyhow::Result<()> {
    Ok(())
}

pub async fn check_dangling_permission_references(db: &DB) -> anyhow::Result<()> {
    Ok(())
}

pub async fn check_database_file_storage_consistency(db: &DB) -> anyhow::Result<()> {
    let all_users = db.get_all_users().await?;
    let config = &SERVER_CONFIG;

    // check that all db FilezFiles that are supposed to have a associated file on the storage actually have one
    for user in all_users {
        let user_files = db.get_files_by_owner_id(&user.user_id).await?;
        for file in user_files {
            let storage_location = get_storage_location_from_file(&config.storage, &file)?;
            // check if file at path exists with rust fs
            if !tokio::fs::metadata(&storage_location.full_path)
                .await?
                .is_file()
            {
                bail!(
                    "File {} with id {} has no corresponding file on the storage",
                    file.name,
                    file.file_id
                );
            }
        }
    }

    // check that all files on the storage have a corresponding entry in the db
    for storage in config.storage.storages.values() {
        if storage.readonly.is_some() {
            continue;
        }
        let mut storage_file_paths = vec![];
        get_files_recursively(&storage.path, &mut storage_file_paths)?;
        for storage_file_path in storage_file_paths {
            let id = storage_file_path
                .strip_prefix(&storage.path)?
                .to_str()
                .unwrap()
                .to_string()
                .replace('/', "");
            let file = db.get_file_by_id(&id).await?;
            if file.is_none() {
                if config.dev.check_database_consistency_remove_orphaned_files {
                    println!(
                        "File {} on the storage has no corresponding entry in the db. Remove orphans is set to true. Removing orphaned file.",
                        storage_file_path.display()
                    );
                    tokio::fs::remove_file(&storage_file_path).await?;
                } else {
                    bail!(
                        "File {} on the storage has no corresponding entry in the db",
                        storage_file_path.display()
                    );
                }
            }
        }
    }

    Ok(())
}

pub fn get_files_recursively(
    path: &std::path::Path,
    files: &mut Vec<std::path::PathBuf>,
) -> anyhow::Result<()> {
    let dir = std::fs::read_dir(path)?;
    for entry in dir {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            get_files_recursively(&path, files)?;
        } else {
            files.push(path);
        }
    }

    Ok(())
}

pub async fn check_storage_use_consistency(db: &DB) -> anyhow::Result<()> {
    let all_users = db.get_all_users().await?;

    for user in all_users {
        let user_files = db.get_files_by_owner_id(&user.user_id).await?;
        for (limit_name, limit) in &user.limits {
            if let Some(limit) = limit {
                let storage_used_files = user_files
                    .iter()
                    .filter(|f| f.storage_id == Some(limit_name.to_string()))
                    .count();
                if limit.used_files != storage_used_files as u64 {
                    bail!(
                        "File count mismatch for user {} and limit {} set on user: {}, actual calculated: {}",
                        user.name.unwrap_or(user.user_id),
                        limit_name,
                        limit.used_files,
                        storage_used_files
                    );
                }
                let storage_used_bytes = user_files
                    .iter()
                    .filter(|f| f.storage_id == Some(limit_name.to_string()))
                    .map(|f| f.size)
                    .sum::<u64>();
                if limit.used_storage != storage_used_bytes {
                    bail!(
                        "File size mismatch for user {} and limit {} set on user: {}, actual calculated: {}",
                        user.name.unwrap_or(user.user_id),
                        limit_name,
                        limit.used_storage,
                        storage_used_bytes
                    );
                }
            }
        }
    }

    Ok(())
}

pub async fn check_group_file_count_consistency(db: &DB) -> anyhow::Result<()> {
    let all_users = db.get_all_users().await?;

    for user in all_users {
        let user_file_groups = db.get_file_groups_by_owner_id(&user.user_id).await?;
        for file_group in user_file_groups {
            let (_, total_files) = db
                .get_files_by_group_id(
                    &user.user_id,
                    &GetItemListRequestBody {
                        id: None,
                        from_index: None,
                        limit: None,
                        sort_field: None,
                        sort_order: None,
                        filter: Some("".to_string()),
                        sub_resource_type: None,
                    },
                    &file_group.file_group_id,
                    vec![],
                    None,
                )
                .await?;
            if total_files != file_group.item_count {
                bail!(
                    "File count mismatch for file group: {:#?} Actual file count is: {:?} but groups file count is: {:?}",
                    file_group,
                    total_files,
                    file_group.item_count
                );
            }
        }
    }

    Ok(())
}

pub async fn create_users(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    let users_to_create = config.users.create.clone();

    let mut new_users = vec![];
    for email in users_to_create {
        if db.get_user_by_email(&email).await?.is_none() {
            let mut user = FilezUser::new(&config.storage, None, Some(email.clone()), None);
            user.set_status(UserStatus::Invited);
            if config.users.make_admin.contains(&email) {
                user.make_admin();
                user.set_visibility(UserVisibility::Public);
            }
            new_users.push(user);
        }
    }

    let res = db.create_users(&new_users).await;
    if res.is_err() {
        println!("Error creating mock user: {:?}", res);
    }

    Ok(())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct MockUser {
    pub name: String,
    pub email: String,
    pub status: UserStatus,
}
