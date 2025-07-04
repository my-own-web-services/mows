pub mod errors;

use crate::utils::{get_uuid, InvalidEnumType};
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::Text,
};
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum, Serialize, Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
}

#[derive(
    Debug, Serialize, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum, Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyResourceType {
    File,
    FileGroup,
    User,
    UserGroup,
}

#[derive(
    Debug, Serialize, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum, Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyEffect {
    Deny,
    Allow,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum AccessPolicyAction {
    #[serde(rename = "filez.files.versions.content.get")]
    FilezFileVersionsContentGet,
    #[serde(rename = "filez.files.versions.content.tus.head")]
    FilezFileVersionsContentTusHead,
    #[serde(rename = "filez.files.versions.content.tus.patch")]
    FilezFileVersionsContentTusPatch,
    #[serde(rename = "filez.files.meta.get")]
    FilesMetaGet,
    #[serde(rename = "filez.files.meta.list")]
    FilesMetaList,
    #[serde(rename = "filez.files.meta.update")]
    FilesMetaUpdate,
    #[serde(rename = "filez.users.get")]
    UsersGet,
    #[serde(rename = "filez.file_groups.list_items")]
    FileGroupListItems,
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

impl AccessPolicy {
    pub fn new(
        name: &str,
        subject_type: AccessPolicySubjectType,
        subject_id: Uuid,
        context_app_id: Option<Uuid>,
        resource_type: AccessPolicyResourceType,
        resource_id: Uuid,
        action: &str,
        effect: AccessPolicyEffect,
    ) -> Self {
        Self {
            id: get_uuid(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            subject_type,
            subject_id,
            context_app_id,
            resource_type,
            resource_id,
            action: action.to_string(),
            effect,
        }
    }
}
