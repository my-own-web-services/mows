use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    ExpressionMethods, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use mows_common_rust::utils::generate_id;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    database::Database,
    errors::FilezError,
    impl_typed_uuid,
    models::users::FilezUserId,
    schema::{self},
    utils::get_current_timestamp,
};

use super::users::{FilezUser, FilezUserType};

impl_typed_uuid!(KeyAccessId);

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = schema::key_access)]
pub struct KeyAccess {
    pub id: KeyAccessId,
    pub owner_id: FilezUserId,
    pub name: String,
    pub key_hash: String,
    pub description: Option<String>,
    pub user_id: FilezUserId,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl KeyAccess {
    #[tracing::instrument(level = "trace")]
    pub fn new(
        owner_id: FilezUserId,
        name: String,
        key_hash: String,
        description: Option<String>,
        user_id: FilezUserId,
    ) -> Self {
        Self {
            id: KeyAccessId::new(),
            owner_id,
            name,
            key_hash,
            description,
            user_id,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        owner_id: FilezUserId,
        name: String,
        description: Option<String>,
        user_id: FilezUserId,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;

        let for_user = FilezUser::get_one_by_id(database, &user_id).await?;
        if for_user.user_type != FilezUserType::KeyAccess {
            return Err(FilezError::Unauthorized(
                "User is not a KeyAccess user".to_string(),
            ));
        }

        let key = generate_id(100);

        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        let key_hash = format!("{:x}", hasher.finalize());

        let new_key_access = KeyAccess::new(owner_id, name, key_hash, description, user_id);

        let created_key_access = diesel::insert_into(schema::key_access::table)
            .values(&new_key_access)
            .returning(KeyAccess::as_returning())
            .get_result::<KeyAccess>(&mut connection)
            .await?;

        Ok(created_key_access)
    }

    #[tracing::instrument(level = "trace")]
    pub async fn parse_key_access_string(
        key_access_string: String,
    ) -> Result<(FilezUserId, String), crate::errors::FilezError> {
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
        Ok((FilezUserId(id), parts[1].to_string()))
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_user_by_key_access_string(
        database: &Database,
        key_access_string: String,
    ) -> Result<FilezUser, FilezError> {
        let mut connection = database.get_connection().await?;
        let (user_id, key) = Self::parse_key_access_string(key_access_string).await?;

        let key_access = schema::key_access::table
            .filter(schema::key_access::user_id.eq(user_id))
            .select(KeyAccess::as_select())
            .first::<KeyAccess>(&mut connection)
            .await?;

        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        let computed_hash = format!("{:x}", hasher.finalize());

        if computed_hash == key_access.key_hash {
            let user = FilezUser::get_one_by_id(database, &user_id).await?;
            if user.user_type != FilezUserType::KeyAccess {
                return Err(FilezError::Unauthorized(
                    "User is not a KeyAccess user".to_string(),
                ));
            } else {
                return Ok(user);
            }
        } else {
            return Err(FilezError::Unauthorized(
                "Invalid key access string".to_string(),
            ));
        }
    }
}
