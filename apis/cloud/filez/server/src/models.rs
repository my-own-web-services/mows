use crate::utils::{get_uuid, InvalidEnumType};
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::Text,
};
use diesel_enum::DbEnum;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Insertable, Clone)]
#[diesel(table_name = crate::schema::files)]
pub struct File {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub mime_type: String,
    pub file_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl File {
    pub fn new(owner: &User, mime_type: &Mime, file_name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            mime_type: mime_type.to_string(),
            file_name: file_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable)]
#[diesel(table_name = crate::schema::users)]
pub struct User {
    pub id: Uuid,
    pub external_user_id: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl User {
    pub fn new(external_user_id: Option<String>, display_name: &str) -> Self {
        Self {
            id: get_uuid(),
            external_user_id,
            display_name: display_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable)]
#[diesel(table_name = crate::schema::file_groups)]
pub struct FileGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub file_group_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Associations, Insertable,
)]
#[diesel(table_name = crate::schema::file_file_group_members)]
#[diesel(belongs_to(File, foreign_key = file_id))]
#[diesel(belongs_to(FileGroup, foreign_key = file_group_id))]
#[diesel(primary_key(file_id, file_group_id))]
pub struct FileFileGroupMember {
    pub file_id: Uuid,
    pub file_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Default)]
#[diesel(table_name = crate::schema::apps)]
pub struct FilezApp {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub owner_id: Uuid,
    pub origins: Vec<String>,
    pub trusted: bool,
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    serde::Serialize,
    Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
}

#[derive(
    Debug,
    serde::Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyResourceType {
    File,
    FileGroup,
}

#[derive(
    Debug,
    serde::Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyEffect {
    Deny,
    Allow,
}

#[derive(Queryable, Selectable, Clone, Insertable, Debug, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::access_policies)]
pub struct AccessPolicy {
    pub id: Uuid,
    pub name: String,

    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,

    #[diesel(sql_type = diesel::sql_types::Text)]
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,

    pub context_app_id: Option<Uuid>,

    #[diesel(sql_type = diesel::sql_types::Text)]
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Uuid,

    pub action: String,

    pub effect: AccessPolicyEffect,
}
