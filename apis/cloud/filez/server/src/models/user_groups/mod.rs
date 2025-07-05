pub mod errors;

use std::collections::HashMap;

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, Selectable,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use errors::UserGroupError;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{schema, utils::get_uuid};

use super::users::FilezUser;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable)]
#[diesel(table_name = crate::schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct UserGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl UserGroup {
    pub fn new(owner: &FilezUser, name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }

    pub async fn get_all_by_user_id(
        db: &crate::db::Db,
        user_id: &Uuid,
    ) -> Result<Vec<Uuid>, UserGroupError> {
        let mut conn = db.pool.get().await?;

        let user_groups = schema::user_user_group_members::table
            .filter(schema::user_user_group_members::user_id.eq(user_id))
            .select(schema::user_user_group_members::user_group_id)
            .load::<Uuid>(&mut conn)
            .await?;

        Ok(user_groups)
    }
}
