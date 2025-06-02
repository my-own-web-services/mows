use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone)]
#[diesel(table_name = crate::schema::files)]
#[diesel(primary_key(file_id))]
pub struct File {
    pub file_id: Uuid,
    pub owner_id: Uuid,
    pub mime_type: String,
    pub file_name: String,
    pub created_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, Insertable, ToSchema, Clone)]
#[diesel(table_name = crate::schema::files)]
pub struct NewFile<'a> {
    pub owner_id: Uuid,
    pub mime_type: &'a str,
    pub file_name: &'a str,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone)]
#[diesel(table_name = crate::schema::users)]
#[diesel(primary_key(user_id))]
pub struct User {
    pub user_id: Uuid,
    pub external_user_id: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, Insertable, ToSchema, Clone)]
#[diesel(table_name = crate::schema::users)]
pub struct NewUser<'a> {
    pub external_user_id: &'a str,
    pub display_name: &'a str,
    pub created_time: chrono::NaiveDateTime,
}
