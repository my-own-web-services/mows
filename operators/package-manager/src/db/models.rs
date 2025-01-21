use crate::db::schema::repositories;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Queryable, Selectable, Debug, Serialize, Deserialize, ToSchema, Clone, PartialEq, Eq)]
#[diesel(table_name = crate::db::schema::repositories)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Repository {
    pub id: i32,
    pub uri: String,
}

#[derive(Insertable, Debug, Serialize, Deserialize, ToSchema, Clone, PartialEq, Eq)]
#[diesel(table_name = repositories)]
pub struct NewRepository {
    pub uri: String,
}
