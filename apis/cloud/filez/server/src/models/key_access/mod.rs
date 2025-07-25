use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    ExpressionMethods, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use mows_common_rust::utils::generate_id;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    db::Db,
    errors::FilezError,
    schema::{self},
    utils::get_uuid,
};

use super::users::FilezUser;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = schema::key_access)]
pub struct KeyAccess {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub key_hash: String,
    pub description: Option<String>,
    pub user_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl KeyAccess {
    pub fn new(
        owner_id: Uuid,
        name: String,
        key_hash: String,
        description: Option<String>,
        user_id: Uuid,
        created_time: chrono::NaiveDateTime,
        modified_time: chrono::NaiveDateTime,
    ) -> Self {
        Self {
            id: get_uuid(),
            owner_id,
            name,
            key_hash,
            description,
            user_id,
            created_time,
            modified_time,
        }
    }

    pub async fn create_key_access(
        db: &Db,
        owner_id: Uuid,
        name: String,
        description: Option<String>,
        user_id: Uuid,
    ) -> Result<Self, FilezError> {
        let mut connection = db.get_connection().await?;

        let key = generate_id(100);

        let salt = SaltString::generate(&mut OsRng);

        let key_hash = Argon2::default()
            .hash_password(key.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!("Failed to hash key: {}", e))?
            .to_string();

        let new_key_access = KeyAccess::new(
            owner_id,
            name,
            key_hash,
            description,
            user_id,
            chrono::Utc::now().naive_utc(),
            chrono::Utc::now().naive_utc(),
        );

        diesel::insert_into(schema::key_access::table)
            .values(&new_key_access)
            .execute(&mut connection)
            .await?;

        Ok(new_key_access)
    }

    pub async fn parse_key_access_string(
        key_access_string: String,
    ) -> Result<(Uuid, String), crate::errors::FilezError> {
        let parts: Vec<&str> = key_access_string.split(':').collect();
        if parts.len() != 2 {
            return Err(crate::errors::FilezError::InvalidRequest(
                "Invalid key access string format".to_string(),
            ));
        }
        let id = Uuid::parse_str(parts[0]).map_err(|_| {
            crate::errors::FilezError::InvalidRequest(
                "Invalid UUID in key access string".to_string(),
            )
        })?;
        Ok((id, parts[1].to_string()))
    }

    pub async fn get_user_by_key_access_string(
        db: &Db,
        key_access_string: String,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = db.get_connection().await?;
        let (user_id, key) = Self::parse_key_access_string(key_access_string).await?;

        let key_access = schema::key_access::table
            .filter(schema::key_access::user_id.eq(user_id))
            .select(KeyAccess::as_select())
            .first::<KeyAccess>(&mut connection)
            .await?;

        let parsed_hash = PasswordHash::new(&key_access.key_hash)
            .map_err(|e| anyhow::anyhow!("Failed to parse key hash: {}", e))?;

        if Argon2::default()
            .verify_password(key.as_bytes(), &parsed_hash)
            .is_ok()
        {
            let user = FilezUser::get_by_id(db, &user_id).await?;
            return Ok(user);
        } else {
            return Err(FilezError::Unauthorized(
                "Invalid key access string".to_string(),
            ));
        }
    }
}
