pub mod check;
pub mod errors;
use crate::{
    api::access_policies::list::ListAccessPoliciesSortBy,
    db::Db,
    errors::FilezError,
    schema,
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
use errors::AccessPolicyError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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

#[derive(DbEnum, Debug, Serialize, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
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

    #[diesel(sql_type = diesel::sql_types::Array<diesel::sql_types::Text>)]
    pub actions: Vec<AccessPolicyAction>,

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
        actions: Vec<AccessPolicyAction>,
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
            actions,
            effect,
        }
    }

    pub async fn create(db: &Db, access_policy: &AccessPolicy) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::insert_into(schema::access_policies::table)
            .values(access_policy)
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_by_id(db: &Db, id: &Uuid) -> Result<AccessPolicy, FilezError> {
        let mut conn = db.pool.get().await?;
        let access_policy = schema::access_policies::table
            .filter(schema::access_policies::id.eq(id))
            .select(AccessPolicy::as_select())
            .first::<AccessPolicy>(&mut conn)
            .await?;
        Ok(access_policy)
    }

    /// Lists all resource ids that the user has access to, for a specific resource type.
    pub async fn get_resources_with_access(
        db: &Db,
        requesting_user_id: &Uuid,
        context_app_id: &Uuid,
        resource_type: &str,
        action_to_perform: &str,
    ) -> Result<Vec<Uuid>, AccessPolicyError> {
        let mut conn = db.pool.get().await?;
        let resource_auth_info = check::get_auth_info(resource_type)?;
        let user_group_ids = UserGroup::get_all_by_user_id(db, requesting_user_id).await?;

        let mut allowed_ids: HashSet<Uuid> = HashSet::new();
        let mut denied_ids: HashSet<Uuid> = HashSet::new();

        // 1. Get resources owned by the user
        let owned_query_string = format!(
            "SELECT {id_col} as id FROM {table_name} WHERE {owner_col} = $1",
            table_name = resource_auth_info.resource_table,
            id_col = resource_auth_info.resource_table_id_column,
            owner_col = resource_auth_info.resource_table_owner_column
        );

        #[derive(QueryableByName, Debug)]
        struct ResourceId {
            #[diesel(sql_type = diesel::sql_types::Uuid)]
            id: Uuid,
        }

        let owned_ids: Vec<ResourceId> = diesel::sql_query(&owned_query_string)
            .bind::<diesel::sql_types::Uuid, _>(requesting_user_id)
            .load::<ResourceId>(&mut conn)
            .await?;
        allowed_ids.extend(owned_ids.into_iter().map(|r| r.id));

        // 2. Get resources with direct policies
        let direct_policies = schema::access_policies::table
            .filter(
                schema::access_policies::resource_type
                    .eq(resource_auth_info.resource_type_policy_str.to_string()),
            )
            .filter(schema::access_policies::context_app_id.eq(context_app_id))
            .filter(schema::access_policies::actions.contains(vec![action_to_perform]))
            .filter(
                schema::access_policies::subject_type
                    .eq(AccessPolicySubjectType::User)
                    .and(schema::access_policies::subject_id.eq(requesting_user_id))
                    .or(schema::access_policies::subject_type
                        .eq(AccessPolicySubjectType::UserGroup)
                        .and(schema::access_policies::subject_id.eq_any(&user_group_ids))),
            )
            .select((
                schema::access_policies::resource_id,
                schema::access_policies::effect,
            ))
            .load::<(Option<Uuid>, AccessPolicyEffect)>(&mut conn)
            .await?;

        for (resource_id, effect) in direct_policies {
            if let Some(id) = resource_id {
                match effect {
                    AccessPolicyEffect::Allow => {
                        allowed_ids.insert(id);
                    }
                    AccessPolicyEffect::Deny => {
                        denied_ids.insert(id);
                    }
                }
            }
        }

        // 3. Get resources with policies on their resource groups
        if let (
            Some(group_membership_table),
            Some(group_membership_table_resource_id_column),
            Some(group_membership_table_group_id_column),
            Some(resource_group_type_policy_str),
        ) = (
            resource_auth_info.group_membership_table,
            resource_auth_info.group_membership_table_resource_id_column,
            resource_auth_info.group_membership_table_group_id_column,
            resource_auth_info.resource_group_type_policy_str,
        ) {
            let group_policies_query = format!(
                "SELECT gm.{resource_id_col} as id, ap.effect
                 FROM {group_membership_table} gm
                 JOIN access_policies ap ON ap.resource_id = gm.{group_id_col}
                 WHERE ap.resource_type = $1
                   AND ap.context_app_id = $2
                   AND ap.actions @> $3
                   AND (
                       (ap.subject_type = 'User' AND ap.subject_id = $4) OR
                       (ap.subject_type = 'UserGroup' AND ap.subject_id = ANY($5))
                   )",
                resource_id_col = group_membership_table_resource_id_column,
                group_id_col = group_membership_table_group_id_column,
                group_membership_table = group_membership_table
            );

            #[derive(QueryableByName, Debug)]
            struct GroupPolicyResult {
                #[diesel(sql_type = diesel::sql_types::Uuid)]
                id: Uuid,
                #[diesel(sql_type = diesel::sql_types::Text)]
                effect: AccessPolicyEffect,
            }

            let group_policies: Vec<GroupPolicyResult> = diesel::sql_query(&group_policies_query)
                .bind::<diesel::sql_types::Text, _>(resource_group_type_policy_str)
                .bind::<diesel::sql_types::Uuid, _>(context_app_id)
                .bind::<diesel::sql_types::Array<Text>, _>(vec![action_to_perform])
                .bind::<diesel::sql_types::Uuid, _>(requesting_user_id)
                .bind::<diesel::sql_types::Array<diesel::sql_types::Uuid>, _>(user_group_ids)
                .load(&mut conn)
                .await?;

            for result in group_policies {
                match result.effect {
                    AccessPolicyEffect::Allow => {
                        allowed_ids.insert(result.id);
                    }
                    AccessPolicyEffect::Deny => {
                        denied_ids.insert(result.id);
                    }
                }
            }
        }

        // 4. Final computation: allowed minus denied
        let final_allowed_ids: Vec<Uuid> = allowed_ids.difference(&denied_ids).cloned().collect();

        Ok(final_allowed_ids)
    }

    pub async fn list_with_user_access(
        db: &Db,
        requesting_user_id: &Uuid,
        app_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<ListAccessPoliciesSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<AccessPolicy>, AccessPolicyError> {
        let mut conn = db.pool.get().await?;

        let resources_with_access = Self::get_resources_with_access(
            db,
            requesting_user_id,
            app_id,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::AccessPolicy).unwrap(),
            &serde_variant::to_variant_name(&AccessPolicyAction::AccessPolicyList).unwrap(),
        )
        .await?;

        let mut query = schema::access_policies::table
            .select(AccessPolicy::as_select())
            .filter(schema::access_policies::id.eq_any(resources_with_access))
            .into_boxed();

        let sort_by = sort_by.unwrap_or(ListAccessPoliciesSortBy::CreatedTime);
        let sort_order = sort_order.unwrap_or(SortDirection::Descending);

        match (sort_by, sort_order) {
            (ListAccessPoliciesSortBy::CreatedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::access_policies::created_time.asc());
            }
            (ListAccessPoliciesSortBy::CreatedTime, SortDirection::Descending) => {
                query = query.order_by(schema::access_policies::created_time.desc());
            }
            (ListAccessPoliciesSortBy::Name, SortDirection::Ascending) => {
                query = query.order_by(schema::access_policies::name.asc());
            }
            (ListAccessPoliciesSortBy::Name, SortDirection::Descending) => {
                query = query.order_by(schema::access_policies::name.desc());
            }
            (ListAccessPoliciesSortBy::ModifiedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::access_policies::modified_time.asc());
            }
            (ListAccessPoliciesSortBy::ModifiedTime, SortDirection::Descending) => {
                query = query.order_by(schema::access_policies::modified_time.desc());
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
        actions: Vec<AccessPolicyAction>,
        effect: AccessPolicyEffect,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;

        update(schema::access_policies::table.filter(schema::access_policies::id.eq(id)))
            .set((
                schema::access_policies::name.eq(name),
                schema::access_policies::subject_type.eq(subject_type),
                schema::access_policies::subject_id.eq(subject_id),
                schema::access_policies::context_app_id.eq(context_app_id),
                schema::access_policies::resource_type.eq(resource_type),
                schema::access_policies::resource_id.eq(resource_id),
                schema::access_policies::actions.eq(actions),
                schema::access_policies::effect.eq(effect),
                schema::access_policies::modified_time.eq(chrono::Utc::now().naive_utc()),
            ))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn delete(db: &Db, id: &Uuid) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(schema::access_policies::table.filter(schema::access_policies::id.eq(id)))
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
    ) -> Result<AuthResult, AccessPolicyError> {
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
