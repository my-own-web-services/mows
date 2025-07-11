use crate::utils::InvalidEnumType;
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable},
    sql_types::SmallInt,
    Selectable,
};

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
    #[diesel(sql_type = diesel::sql_types::SmallInt)]
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
