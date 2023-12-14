use crate::{config::SERVER_CONFIG, db::DB};
use anyhow::bail;
use filez_common::server::{GetItemListRequestBody, UserStatus};
use serde::{Deserialize, Serialize};

pub async fn dev(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    if config.dev.create_mock_users {
        create_mock_users(db).await?;
    }

    if !config.users.create.is_empty() {
        create_users(db).await?;
    }

    if config.dev.check_database_consistency {
        match check_database_consistency(db).await {
            Ok(_) => println!("Database consistency check passed: Everything is fine!"),
            Err(e) => println!("Database consistency check failed: {}", e),
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

    dbg!(&mock_users);

    for mock_user in mock_users {
        if db.get_user_by_email(&mock_user.email).await?.is_none() {
            let res = db
                .create_user(
                    None,
                    Some(mock_user.status),
                    Some(mock_user.name),
                    Some(mock_user.email),
                )
                .await;
            if res.is_err() {
                println!("Error creating mock user: {:#?}", res);
            }
        }
    }

    Ok(())
}

pub async fn check_database_consistency(db: &DB) -> anyhow::Result<()> {
    check_group_file_count_consistency(db).await?;
    check_storage_use_consistency(db).await?;

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
                    &file_group.file_group_id,
                    &GetItemListRequestBody {
                        id: None,
                        from_index: None,
                        limit: None,
                        sort_field: None,
                        sort_order: None,
                        filter: None,
                    },
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

    for user in users_to_create {
        if db.get_user_by_email(&user).await?.is_none() {
            let res = db
                .create_user(None, Some(UserStatus::Active), None, Some(user))
                .await;
            if res.is_err() {
                println!("Error creating mock user: {:?}", res);
            }
        }
    }

    Ok(())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct MockUser {
    pub name: String,
    pub email: String,
    pub status: UserStatus,
}
