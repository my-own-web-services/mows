pub mod check;
pub mod errors;
use crate::{
    db::Db,
    errors::FilezError,
    utils::{get_uuid, InvalidEnumType},
};
use check::{check_resources_access_control, AuthResult};
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::Text,
};
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::user_groups::UserGroup;

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
#[serde(rename_all = "snake_case")]
pub enum AccessPolicyResourceType {
    File,
    FileGroup,
    User,
    UserGroup,
    StorageLocation,
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

    /// For a file creation action, the resource ID is the requesting users ID.
    #[serde(rename = "filez.files.create")]
    FilezFileCreate,
    #[serde(rename = "filez.files.meta.get")]
    FilesMetaGet,
    #[serde(rename = "filez.files.meta.list")]
    FilesMetaList,
    #[serde(rename = "filez.files.meta.update")]
    FilesMetaUpdate,

    #[serde(rename = "filez.users.get")]
    UsersGet,

    #[serde(rename = "filez.file_groups.create")]
    FileGroupCreate,
    #[serde(rename = "filez.file_groups.read")]
    FileGroupRead,
    #[serde(rename = "filez.file_groups.update")]
    FileGroupUpdate,
    #[serde(rename = "filez.file_groups.delete")]
    FileGroupDelete,
    #[serde(rename = "filez.file_groups.list")]
    FileGroupList,
    #[serde(rename = "filez.file_groups.list_files")]
    FileGroupListFiles,

    #[serde(rename = "filez.user_groups.create")]
    UserGroupCreate,
    #[serde(rename = "filez.user_groups.read")]
    UserGroupRead,
    #[serde(rename = "filez.user_groups.update")]
    UserGroupUpdate,
    #[serde(rename = "filez.user_groups.delete")]
    UserGroupDelete,
    #[serde(rename = "filez.user_groups.list")]
    UserGroupList,
    #[serde(rename = "filez.user_groups.list_users")]
    UserGroupListUsers,
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
    pub resource_id: Option<Uuid>,

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
        resource_id: Option<Uuid>,
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

    pub async fn check(
        db: &Db,
        requesting_user_id: &Uuid,
        context_app_id: &Uuid,
        context_app_trusted: bool,
        resource_type: &str,
        requested_resource_ids: Option<&[Uuid]>,
        action_to_perform: &str,
    ) -> Result<AuthResult, FilezError> {
        let user_group_ids = UserGroup::get_all_by_user_id(db, requesting_user_id).await?;

        check_resources_access_control(
            db,
            requesting_user_id,
            &user_group_ids,
            context_app_id,
            context_app_trusted,
            resource_type,
            requested_resource_ids,
            action_to_perform,
        )
        .await
    }
}
