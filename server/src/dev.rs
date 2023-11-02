use crate::{config::SERVER_CONFIG, db::DB, types::UserStatus};
use anyhow::bail;
use serde::{Deserialize, Serialize};

pub async fn dev(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    if config.dev.create_mock_users {
        create_mock_users(db).await?;
    }
    if !config.users.create.is_empty() {
        create_users(db).await?;
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
                println!("Error creating mock user: {:?}", res);
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
                .create_user(
                    None,
                    Some(crate::types::UserStatus::Active),
                    None,
                    Some(user),
                )
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
