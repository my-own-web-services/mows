use crate::{
    database::Database,
    utils::{get_current_timestamp, InvalidEnumType},
};
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable},
    query_dsl::methods::FilterDsl,
    sql_types::SmallInt,
    ExpressionMethods, Selectable,
};
use diesel_async::RunQueryDsl;

use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug, AsChangeset,
)]
#[diesel(table_name = crate::schema::user_relations)]
#[diesel(check_for_backend(Pg))]
pub struct UserRelation {
    pub user_id: Uuid,
    pub friend_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub status: UserRelationStatus,
}

#[derive(
    Debug,
    Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum UserRelationStatus {
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
    Blocked = 3,
}

impl UserRelation {
    pub fn new(user_id: Uuid, friend_id: Uuid, status: UserRelationStatus) -> Self {
        Self {
            user_id,
            friend_id,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            status,
        }
    }

    pub async fn create_relation(
        database: &Database,
        user_id: Uuid,
        friend_id: Uuid,
        status: UserRelationStatus,
    ) -> Result<Self, crate::errors::FilezError> {
        let mut connection = database.get_connection().await?;
        let relation = Self::new(user_id, friend_id, status);

        diesel::insert_into(crate::schema::user_relations::table)
            .values(&relation)
            .execute(&mut connection)
            .await?;

        Ok(relation)
    }

    pub async fn update_status(
        database: &Database,
        user_id: Uuid,
        friend_id: Uuid,
        new_status: UserRelationStatus,
    ) -> Result<Self, crate::errors::FilezError> {
        let mut connection = database.get_connection().await?;

        let relation = diesel::update(
            crate::schema::user_relations::table
                .filter(crate::schema::user_relations::user_id.eq(user_id))
                .filter(crate::schema::user_relations::friend_id.eq(friend_id)),
        )
        .set((
            crate::schema::user_relations::status.eq(new_status),
            crate::schema::user_relations::modified_time.eq(get_current_timestamp()),
        ))
        .get_result(&mut connection)
        .await?;

        Ok(relation)
    }
}
