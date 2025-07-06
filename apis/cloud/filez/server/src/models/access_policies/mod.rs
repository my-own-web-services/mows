pub mod check;
pub mod errors;
use crate::{
    api::access_policies::list::ListAccessPoliciesSortBy,
    db::Db,
    errors::FilezError,
    schema::{access_policies, file_versions::app_id},
    types::SortDirection,
    utils::{get_uuid, InvalidEnumType},
};
use check::{check_resources_access_control, AuthResult};
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::Text, update,
    AsChangeset,
};
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::user_groups::UserGroup;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Serialize,
    Deserialize,
    ToSchema,
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
    AccessPolicy,
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
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyEffect {
    Deny,
    Allow,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
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

    #[serde(rename = "filez.access_policies.create")]
    AccessPolicyCreate,
    #[serde(rename = "filez.access_policies.read")]
    AccessPolicyRead,
    #[serde(rename = "filez.access_policies.update")]
    AccessPolicyUpdate,
    #[serde(rename = "filez.access_policies.delete")]
    AccessPolicyDelete,
    #[serde(rename = "filez.access_policies.list")]
    AccessPolicyList,
}

#[derive(
    Queryable,
    Selectable,
    Clone,
    Insertable,
    Debug,
    QueryableByName,
    Serialize,
    Deserialize,
    ToSchema,
    AsChangeset,
)]
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

    pub async fn create(db: &Db, access_policy: &AccessPolicy) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::insert_into(access_policies::table)
            .values(access_policy)
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_by_id(db: &Db, id: &Uuid) -> Result<AccessPolicy, FilezError> {
        let mut conn = db.pool.get().await?;
        let access_policy = access_policies::table
            .filter(access_policies::id.eq(id))
            .select(AccessPolicy::as_select())
            .first::<AccessPolicy>(&mut conn)
            .await?;
        Ok(access_policy)
    }

    /// Lists all resource ids that the user has access to, for a specific resource type.
    pub async fn get_resources_with_access(
        db: &Db,
        requesting_user_id: &Uuid,
        requesting_app_id: &Uuid,
        resource_type: &str,
        action_to_perform: &str,
    ) -> Result<Vec<Uuid>, FilezError> {
        let user_group_ids = UserGroup::get_all_by_user_id(db, requesting_user_id).await?;

        todo!()
    }

    pub async fn list_with_user_access(
        db: &Db,
        requesting_user_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<ListAccessPoliciesSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<AccessPolicy>, FilezError> {
        let mut conn = db.pool.get().await?;

        let mut query = access_policies::table
            .select(AccessPolicy::as_select())
            .filter(access_policies::owner_id.eq(requesting_user_id))
            .into_boxed();

        let sort_by = sort_by.unwrap_or(ListAccessPoliciesSortBy::CreatedTime);
        let sort_order = sort_order.unwrap_or(SortDirection::Descending);

        match (sort_by, sort_order) {
            (ListAccessPoliciesSortBy::CreatedTime, SortDirection::Ascending) => {
                query = query.order_by(access_policies::created_time.asc());
            }
            (ListAccessPoliciesSortBy::CreatedTime, SortDirection::Descending) => {
                query = query.order_by(access_policies::created_time.desc());
            }
            (ListAccessPoliciesSortBy::Name, SortDirection::Ascending) => {
                query = query.order_by(access_policies::name.asc());
            }
            (ListAccessPoliciesSortBy::Name, SortDirection::Descending) => {
                query = query.order_by(access_policies::name.desc());
            }
            (ListAccessPoliciesSortBy::ModifiedTime, SortDirection::Ascending) => {
                query = query.order_by(access_policies::modified_time.asc());
            }
            (ListAccessPoliciesSortBy::ModifiedTime, SortDirection::Descending) => {
                query = query.order_by(access_policies::modified_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index);
        }

        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        let access_policies = query.load::<AccessPolicy>(&mut conn).await?;
        Ok(access_policies)
    }

    pub async fn update(
        db: &Db,
        id: &Uuid,
        name: &str,
        subject_type: AccessPolicySubjectType,
        subject_id: Uuid,
        context_app_id: Option<Uuid>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        action: &str,
        effect: AccessPolicyEffect,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        update(access_policies::table.filter(access_policies::id.eq(id)))
            .set((
                access_policies::name.eq(name),
                access_policies::subject_type.eq(subject_type),
                access_policies::subject_id.eq(subject_id),
                access_policies::context_app_id.eq(context_app_id),
                access_policies::resource_type.eq(resource_type),
                access_policies::resource_id.eq(resource_id),
                access_policies::action.eq(action),
                access_policies::effect.eq(effect),
                access_policies::modified_time.eq(chrono::Utc::now().naive_utc()),
            ))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn delete(db: &Db, id: &Uuid) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(access_policies::table.filter(access_policies::id.eq(id)))
            .execute(&mut conn)
            .await?;
        Ok(())
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
