pub mod check;
use super::{user_groups::UserGroup, users::FilezUser};
use crate::models::user_groups::UserGroupId;
use crate::{
    database::Database,
    errors::FilezError,
    http_api::{
        access_policies::list::ListAccessPoliciesSortBy,
        authentication::middleware::AuthenticationInformation,
    },
    impl_typed_compound_uuid, impl_typed_uuid,
    models::{
        apps::{MowsApp, MowsAppId},
        users::FilezUserId,
    },
    schema::{self},
    types::SortDirection,
    utils::{get_current_timestamp, InvalidEnumType},
};
use anyhow::Context;
use check::{check_resources_access_control, AuthResult};
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::SmallInt,
    update, AsChangeset,
};
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use std::collections::HashSet;
use utoipa::ToSchema;
use uuid::Uuid;

/// ```
/// filter_subject_access_policies!(requesting_user_id: &Uuid, user_group_ids: Vec<Uuid>)
/// ```
#[macro_export]
macro_rules! filter_subject_access_policies {
    ($maybe_requesting_user:expr, $maybe_user_group_ids:expr) => {{
        let maybe_requesting_user: Option<&FilezUser> = $maybe_requesting_user;

        let maybe_user_group_ids: Option<&Vec<crate::models::user_groups::UserGroupId>> =
            $maybe_user_group_ids;
        let predicate: Box<
            dyn BoxableExpression<
                schema::access_policies::table,
                _,
                SqlType = diesel::sql_types::Bool,
            >,
        > = match maybe_requesting_user {
            Some(requesting_user) => Box::new(
                schema::access_policies::subject_type
                    .eq(AccessPolicySubjectType::Public)
                    .or(schema::access_policies::subject_type
                        .eq(AccessPolicySubjectType::ServerMember))
                    .or(schema::access_policies::subject_type
                        .eq(AccessPolicySubjectType::User)
                        .and(schema::access_policies::subject_id.eq(requesting_user.id)))
                    .or(schema::access_policies::subject_type
                        .eq(AccessPolicySubjectType::UserGroup)
                        .and(
                            schema::access_policies::subject_id
                                .eq_any(maybe_user_group_ids.unwrap()),
                        )),
            ),
            None => {
                Box::new(schema::access_policies::subject_type.eq(AccessPolicySubjectType::Public))
            }
        };
        predicate
    }};
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
    Serialize,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicySubjectType {
    User = 0,
    UserGroup = 1,
    ServerMember = 2,
    Public = 3,
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
pub enum AccessPolicyResourceType {
    File = 0,
    // FileVersion policies are related to the file itself, not the version
    FileGroup = 1,
    User = 2,
    UserGroup = 3,
    StorageLocation = 4,
    AccessPolicy = 5,
    StorageQuota = 6,
    FilezJob = 7,
    App = 8,
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
pub enum AccessPolicyEffect {
    Deny = 0,
    Allow = 1,
}

#[derive(DbEnum, Debug, Serialize, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyAction {
    FilezFilesCreate = 0,
    FilezFilesDelete = 10,
    FilezFilesGet = 20,
    FilezFilesUpdate = 30,

    FilezFilesVersionsContentGet = 70,
    FilezFilesVersionsContentTusHead = 80,
    FilezFilesVersionsContentTusPatch = 90,
    FilezFilesVersionsDelete = 100,
    FilezFilesVersionsGet = 110,
    FilezFilesVersionsUpdate = 120,
    FilezFilesVersionsCreate = 130,

    UsersGet = 140,
    UsersList = 150,
    UsersCreate = 160,
    UsersUpdate = 170,
    UsersDelete = 180,

    FileGroupsCreate = 190,
    FileGroupsGet = 200,
    FileGroupsUpdate = 210,
    FileGroupsDelete = 220,
    FileGroupsList = 230,
    FileGroupsListFiles = 240,
    FileGroupsUpdateMembers = 250,

    UserGroupsCreate = 260,
    UserGroupsGet = 270,
    UserGroupsUpdate = 280,
    UserGroupsDelete = 290,
    UserGroupsList = 300,
    UserGroupsListUsers = 310,
    UserGroupsUpdateMembers = 320,

    AccessPoliciesCreate = 330,
    AccessPoliciesGet = 340,
    AccessPoliciesUpdate = 350,
    AccessPoliciesDelete = 360,
    AccessPoliciesList = 370,

    StorageQuotasCreate = 380,
    StorageQuotasGet = 390,
    StorageQuotasUpdate = 400,
    StorageQuotasDelete = 410,
    StorageQuotasList = 420,

    StorageLocationsGet = 430,
    StorageLocationsList = 440,

    TagsUpdate = 450,
    TagsGet = 460,

    FilezJobsCreate = 470,
    FilezJobsGet = 480,
    FilezJobsUpdate = 490,
    FilezJobsDelete = 500,
    FilezJobsList = 510,
    FilezJobsPickup = 520,

    FilezAppsGet = 530,
    FilezAppsList = 540,
}

impl_typed_uuid!(AccessPolicyId);
impl_typed_uuid!(AccessPolicySubjectId);

impl_typed_compound_uuid!(AccessPolicySubjectId: FilezUserId, UserGroupId);

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
)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::access_policies)]
pub struct AccessPolicy {
    pub id: AccessPolicyId,
    pub name: String,
    pub owner_id: FilezUserId,

    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,

    pub subject_type: AccessPolicySubjectType,
    pub subject_id: AccessPolicySubjectId,

    /// The IDs of the application this policy is associated with
    pub context_app_ids: Vec<MowsAppId>,

    pub resource_type: AccessPolicyResourceType,
    /// The ID of the resource this policy applies to, if no resource ID is provided, the policy is a type level policy, allowing for example the creation of a resource of that type.
    pub resource_id: Option<Uuid>,

    pub actions: Vec<AccessPolicyAction>,

    pub effect: AccessPolicyEffect,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate, AsChangeset)]
#[diesel(table_name = schema::access_policies)]
pub struct UpdateAccessPolicyChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_access_policy_name: Option<String>,

    #[diesel(column_name = subject_type)]
    pub new_access_policy_subject_type: Option<AccessPolicySubjectType>,

    #[diesel(column_name = subject_id)]
    pub new_access_policy_subject_id: Option<AccessPolicySubjectId>,

    #[diesel(column_name = context_app_ids)]
    pub new_context_app_ids: Option<Vec<MowsAppId>>,

    #[diesel(column_name = resource_type)]
    pub new_access_policy_resource_type: Option<AccessPolicyResourceType>,

    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[diesel(column_name = resource_id)]
    pub new_resource_id: Option<Option<Uuid>>,

    #[diesel(column_name = actions)]
    pub new_access_policy_actions: Option<Vec<AccessPolicyAction>>,

    #[diesel(column_name = effect)]
    pub new_access_policy_effect: Option<AccessPolicyEffect>,
}

impl AccessPolicy {
    #[tracing::instrument(level = "trace")]
    fn new(
        name: &str,
        owner_id: FilezUserId,
        subject_type: AccessPolicySubjectType,
        subject_id: AccessPolicySubjectId,
        context_app_ids: Vec<MowsAppId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        actions: Vec<AccessPolicyAction>,
        effect: AccessPolicyEffect,
    ) -> Self {
        Self {
            id: AccessPolicyId::new(),
            owner_id,
            name: name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            subject_id,
            subject_type,
            context_app_ids,
            resource_type,
            resource_id,
            actions,
            effect,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        name: &str,
        owner_id: FilezUserId,
        subject_type: AccessPolicySubjectType,
        subject_id: AccessPolicySubjectId,
        context_app_ids: Vec<MowsAppId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        actions: Vec<AccessPolicyAction>,
        effect: AccessPolicyEffect,
    ) -> Result<AccessPolicy, FilezError> {
        let access_policy = AccessPolicy::new(
            name,
            owner_id,
            subject_type,
            subject_id,
            context_app_ids,
            resource_type,
            resource_id,
            actions,
            effect,
        );
        let mut connection = database.get_connection().await?;
        let created_access_policy = diesel::insert_into(schema::access_policies::table)
            .values(&access_policy)
            .returning(AccessPolicy::as_select())
            .get_result::<AccessPolicy>(&mut connection)
            .await?;

        Ok(created_access_policy)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_by_id(
        database: &Database,
        id: &AccessPolicyId,
    ) -> Result<AccessPolicy, FilezError> {
        let mut connection = database.get_connection().await?;
        let access_policy = schema::access_policies::table
            .filter(schema::access_policies::id.eq(id))
            .select(AccessPolicy::as_select())
            .first::<AccessPolicy>(&mut connection)
            .await?;
        Ok(access_policy)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_ids(
        database: &Database,
        ids: &[AccessPolicyId],
    ) -> Result<Vec<AccessPolicy>, FilezError> {
        let mut connection = database.get_connection().await?;
        let access_policies = schema::access_policies::table
            .filter(schema::access_policies::id.eq_any(ids))
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await?;
        Ok(access_policies)
    }

    /// Lists all resource ids that the user has access to, for a specific resource type.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_resources_with_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        resource_type: AccessPolicyResourceType,
        action_to_perform: AccessPolicyAction,
    ) -> Result<Vec<Uuid>, FilezError> {
        let mut connection = database.get_connection().await?;
        let resource_auth_info = check::get_auth_params_for_resource_type(resource_type);
        let maybe_user_group_ids = match maybe_requesting_user {
            Some(requesting_user) => {
                Some(UserGroup::get_all_ids_by_user_id(database, &requesting_user.id).await?)
            }
            None => None,
        };

        let mut allowed_ids: HashSet<Uuid> = HashSet::new();
        let mut denied_ids: HashSet<Uuid> = HashSet::new();

        if let Some(requesting_user) = maybe_requesting_user {
            if let Some(owner_col) = resource_auth_info.resource_table_owner_column {
                // 1. Get resources owned by the user
                let owned_query_string = format!(
                    "SELECT {id_col} as id FROM {table_name} WHERE {owner_col} = $1",
                    table_name = resource_auth_info.resource_table,
                    id_col = resource_auth_info.resource_table_id_column,
                    owner_col = owner_col
                );

                #[derive(QueryableByName, Debug)]
                struct ResourceId {
                    #[diesel(sql_type = diesel::sql_types::Uuid)]
                    id: Uuid,
                }

                let owned_ids: Vec<ResourceId> = diesel::sql_query(&owned_query_string)
                    .bind::<diesel::sql_types::Uuid, _>(requesting_user.id)
                    .load::<ResourceId>(&mut connection)
                    .await?;
                allowed_ids.extend(owned_ids.into_iter().map(|r| r.id));
            }
        }

        // 2. Get resources with direct policies
        let direct_policies = schema::access_policies::table
            .filter(schema::access_policies::resource_type.eq(resource_auth_info.resource_type))
            .filter(schema::access_policies::context_app_ids.contains(vec![requesting_app.id]))
            .filter(schema::access_policies::actions.contains(vec![action_to_perform]))
            .filter(filter_subject_access_policies!(
                maybe_requesting_user,
                maybe_user_group_ids.as_ref()
            ))
            .select((
                schema::access_policies::resource_id,
                schema::access_policies::effect,
            ))
            .load::<(Option<Uuid>, AccessPolicyEffect)>(&mut connection)
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
            Some(resource_group_type),
        ) = (
            resource_auth_info.group_membership_table,
            resource_auth_info.group_membership_table_resource_id_column,
            resource_auth_info.group_membership_table_group_id_column,
            resource_auth_info.resource_group_type,
        ) {
            #[derive(QueryableByName, Debug)]
            struct GroupPolicyResult {
                #[diesel(sql_type = diesel::sql_types::Uuid)]
                id: Uuid,
                #[diesel(sql_type = diesel::sql_types::SmallInt)]
                effect: AccessPolicyEffect,
            }

            let resource_group_policies: Vec<GroupPolicyResult> = match maybe_requesting_user {
                Some(requesting_user) => {
                    let resource_group_policies_query = format!(
                        "SELECT gm.{resource_id_col} as id, ap.effect
                 FROM {group_membership_table} gm
                 JOIN access_policies ap ON ap.resource_id = gm.{group_id_col}
                 WHERE ap.resource_type = $1
                   AND ap.context_app_id @> $2
                   AND ap.actions @> $3
                   AND (
                        (ap.subject_type = 'User' AND ap.subject_id = $4) OR
                        (ap.subject_type = 'UserGroup' AND ap.subject_id = ANY($5)) OR
                        (ap.subject_type = 'ServerMember') OR
                        (ap.subject_type = 'Public')
                   )",
                        resource_id_col = group_membership_table_resource_id_column,
                        group_id_col = group_membership_table_group_id_column,
                        group_membership_table = group_membership_table
                    );

                    diesel::sql_query(&resource_group_policies_query)
                        .bind::<diesel::sql_types::SmallInt, _>(resource_group_type)
                        .bind::<diesel::sql_types::Array<diesel::sql_types::Uuid>, _>(vec![
                            requesting_app.id,
                        ])
                        .bind::<diesel::sql_types::Array<SmallInt>, _>(vec![action_to_perform])
                        .bind::<diesel::sql_types::Uuid, _>(requesting_user.id)
                        .bind::<diesel::sql_types::Array<diesel::sql_types::Uuid>, _>(
                            maybe_user_group_ids.unwrap_or(Vec::new()),
                        )
                        .load(&mut connection)
                        .await?
                }
                None => {
                    let resource_group_policies_query = format!(
                        "SELECT gm.{resource_id_col} as id, ap.effect
                 FROM {group_membership_table} gm
                 JOIN access_policies ap ON ap.resource_id = gm.{group_id_col}
                 WHERE ap.resource_type = $1
                   AND ap.context_app_id @> $2
                   AND ap.actions @> $3
                   AND ap.subject_type = 'Public'",
                        resource_id_col = group_membership_table_resource_id_column,
                        group_id_col = group_membership_table_group_id_column,
                        group_membership_table = group_membership_table
                    );

                    diesel::sql_query(&resource_group_policies_query)
                        .bind::<diesel::sql_types::SmallInt, _>(resource_group_type)
                        .bind::<diesel::sql_types::Array<diesel::sql_types::Uuid>, _>(vec![
                            requesting_app.id,
                        ])
                        .bind::<diesel::sql_types::Array<SmallInt>, _>(vec![action_to_perform])
                        .load(&mut connection)
                        .await?
                }
            };

            for result in resource_group_policies {
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

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_with_user_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListAccessPoliciesSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<AccessPolicy>, FilezError> {
        let mut connection = database.get_connection().await?;

        let resources_with_access = Self::get_resources_with_access(
            database,
            maybe_requesting_user,
            requesting_app,
            AccessPolicyResourceType::AccessPolicy,
            AccessPolicyAction::AccessPoliciesList,
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
            query = query.offset(from_index.try_into()?);
        }

        if let Some(limit) = limit {
            query = query.limit(limit.try_into()?);
        }

        let access_policies = query.load::<AccessPolicy>(&mut connection).await?;
        Ok(access_policies)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_one(
        database: &Database,
        access_policy_id: &AccessPolicyId,
        changeset: UpdateAccessPolicyChangeset,
    ) -> Result<AccessPolicy, FilezError> {
        let mut connection = database.get_connection().await?;

        let updated_access_policy = update(
            schema::access_policies::table.filter(schema::access_policies::id.eq(access_policy_id)),
        )
        .set((
            changeset,
            schema::access_policies::modified_time.eq(get_current_timestamp()),
        ))
        .returning(AccessPolicy::as_select())
        .get_result::<AccessPolicy>(&mut connection)
        .await?;

        Ok(updated_access_policy)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(database: &Database, id: &Uuid) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(schema::access_policies::table.filter(schema::access_policies::id.eq(id)))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn check(
        database: &Database,
        authentication_information: &AuthenticationInformation,
        resource_type: AccessPolicyResourceType,
        requested_resource_ids: Option<&[Uuid]>,
        action_to_perform: AccessPolicyAction,
    ) -> Result<AuthResult, FilezError> {
        let maybe_user_group_ids = match &authentication_information.requesting_user {
            Some(requesting_user) => Some(
                UserGroup::get_all_ids_by_user_id(database, &requesting_user.id)
                    .await
                    .context("Failed to get user groups for the requesting user")?,
            ),
            None => None,
        };

        check_resources_access_control(
            database,
            authentication_information.requesting_user.as_ref(),
            maybe_user_group_ids.as_ref(),
            &authentication_information.requesting_app,
            resource_type,
            requested_resource_ids,
            action_to_perform,
        )
        .await
    }
}
