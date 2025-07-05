pub mod errors;

use std::collections::HashMap;

use bigdecimal::BigDecimal;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    query_dsl::methods::{FilterDsl, FindDsl},
    ExpressionMethods, OptionalExtension, Selectable,
};
use diesel_async::RunQueryDsl;
use errors::FilezUserError;
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{config::config, errors::FilezError, schema, utils::get_uuid};

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct FilezUser {
    pub id: Uuid,
    pub external_user_id: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    #[schema(value_type=i64)]
    pub storage_limit: BigDecimal,
}

impl FilezUser {
    pub fn new(external_user_id: Option<String>, display_name: &str, storage_limit: i64) -> Self {
        Self {
            id: get_uuid(),
            external_user_id,
            display_name: display_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            deleted: false,
            storage_limit: BigDecimal::from(storage_limit),
        }
    }

    pub async fn apply(
        db: &crate::db::Db,
        external_user_id: &str,
        display_name: &str,
    ) -> Result<uuid::Uuid, FilezUserError> {
        let mut conn = db.pool.get().await?;

        let config = get_current_config_cloned!(config());

        // Check if the user already exists
        let existing_user = crate::schema::users::table
            .filter(crate::schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut conn)
            .await
            .optional()?;

        if let Some(user) = existing_user {
            // update the existing users display name
            diesel::update(crate::schema::users::table.find(user.id))
                .set(crate::schema::users::display_name.eq(display_name))
                .execute(&mut conn)
                .await?;
            return Ok(user.id);
        };
        // If the user does not exist, create a new user
        let new_user = FilezUser::new(
            Some(external_user_id.to_string()),
            display_name,
            config.default_storage_limit,
        );

        let result = diesel::insert_into(crate::schema::users::table)
            .values(&new_user)
            .get_result::<FilezUser>(&mut conn)
            .await?;
        Ok(result.id)
    }

    pub async fn get_many_by_id(
        db: &crate::db::Db,
        user_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, FilezUser>, FilezUserError> {
        let mut conn = db.pool.get().await?;

        let users: Vec<FilezUser> = schema::users::table
            .filter(schema::users::id.eq_any(user_ids))
            .load(&mut conn)
            .await?;
        let user_map: HashMap<Uuid, FilezUser> =
            users.into_iter().map(|user| (user.id, user)).collect();
        Ok(user_map)
    }

    pub async fn get_by_external_id(
        db: &crate::db::Db,
        external_user_id: &str,
    ) -> Result<FilezUser, FilezUserError> {
        let mut conn = db.pool.get().await?;

        let result = schema::users::table
            .filter(schema::users::external_user_id.eq(external_user_id))
            .first::<FilezUser>(&mut conn)
            .await?;

        Ok(result)
    }
}
