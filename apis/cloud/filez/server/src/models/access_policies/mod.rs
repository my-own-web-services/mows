pub mod check;
pub mod store;
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
use mows_auth_core::types::{Effect, SubjectType};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
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
                    .eq(SubjectType::Public)
                    .or(schema::access_policies::subject_type
                        .eq(SubjectType::ServerMember))
                    .or(schema::access_policies::subject_type
                        .eq(SubjectType::User)
                        .and(schema::access_policies::subject_id.eq(requesting_user.id)))
                    .or(schema::access_policies::subject_type
                        .eq(SubjectType::UserGroup)
                        .and(
                            schema::access_policies::subject_id
                                .eq_any(maybe_user_group_ids.unwrap()),
                        )),
            ),
            None => {
                Box::new(schema::access_policies::subject_type.eq(SubjectType::Public))
            }
        };
        predicate
    }};
}

// SubjectType (the principal axis: User / UserGroup / ServerMember /
// Public) is engine-owned. Filez imports it directly from
// mows_auth_core wherever needed — see mod-level `use` above.

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
    MowsApp = 8,
}

impl AccessPolicyResourceType {
    /// Reverse of `as u32` — used at the engine-registry boundary
    /// when a `ResourceAuthInfo.resource_group_type: Option<u32>`
    /// needs to be bound to a `schema::access_policies::resource_type`
    /// SmallInt column. Returns `None` for unknown integers; the
    /// registry is populated from these very variants at startup so
    /// callers can safely `.expect("registered type")`.
    pub fn from_u32(t: u32) -> Option<Self> {
        match t {
            0 => Some(Self::File),
            1 => Some(Self::FileGroup),
            2 => Some(Self::User),
            3 => Some(Self::UserGroup),
            4 => Some(Self::StorageLocation),
            5 => Some(Self::AccessPolicy),
            6 => Some(Self::StorageQuota),
            7 => Some(Self::FilezJob),
            8 => Some(Self::MowsApp),
            _ => None,
        }
    }
}

// Effect (Deny=0, Allow=1) is engine-owned. Filez imports
// mows_auth_core::types::Effect wherever needed.

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

    // Phase 4 user-group lifecycle (USER_GROUPS.md §6). Gaps in
    // the discriminant sequence are deliberate — pre-allocates space
    // for sibling actions on the same surface without renumbering.
    UserGroupsRequestJoin = 550,
    UserGroupsApprove = 560,
    UserGroupsInvite = 570,
    UserGroupsRespondToInvite = 580,
    UserGroupsLeave = 590,
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

    pub subject_type: SubjectType,
    pub subject_id: AccessPolicySubjectId,

    /// The IDs of the application this policy is associated with
    pub context_app_ids: Vec<MowsAppId>,

    pub resource_type: AccessPolicyResourceType,
    /// The ID of the resource this policy applies to, if no resource ID is provided, the policy is a type level policy, allowing for example the creation of a resource of that type.
    pub resource_id: Option<Uuid>,

    pub actions: Vec<AccessPolicyAction>,

    pub effect: Effect,

    /// How broadly the policy applies (POLICY_SEMANTICS.md §4).
    /// Single = the historic behaviour (`resource_id` pins the target).
    /// OwnedByOwner / AccessibleByOwner apply to whole resource sets
    /// defined by the policy's owner.
    pub resource_scope: mows_auth_core::types::ResourceScope,

    /// Soft auto-expiry (DATA_MODEL.md §2.4). NULL = never expires.
    /// PolicyStore queries filter on `(expires_at IS NULL OR expires_at > now())`.
    pub expires_at: Option<chrono::NaiveDateTime>,
    /// Soft delete (revocation that preserves audit trail). PolicyStore
    /// queries filter on `NOT revoked`. The Picker UI flips this column
    /// to revoke a consent; never `DELETE FROM access_policies`.
    pub revoked: bool,
    /// Cross-API bundle grouping (USAGE_LIMITS.md "Cross-API bundles").
    /// Non-NULL when this policy was created together with other policies
    /// in one Picker consent transaction. Opaque to the engine — only
    /// the share-management UI / bulk-revoke queries consult it.
    pub policy_bundle_id: Option<Uuid>,
}

impl From<&AccessPolicy> for mows_auth_core::PolicyView {
    /// Project filez's full AccessPolicy row down to the minimal
    /// fields the engine's check_access consumes. Used at the
    /// PolicyStore boundary when filez serves rows to the engine —
    /// the engine never sees filez's name / timestamps / etc.
    fn from(p: &AccessPolicy) -> Self {
        Self {
            id: p.id.0.into(),
            owner_id: p.owner_id.0.into(),
            effect: p.effect.into(),
            subject_type: p.subject_type.into(),
            subject_id: p.subject_id.0.into(),
            resource_scope: p.resource_scope,
        }
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate, AsChangeset)]
#[diesel(table_name = schema::access_policies)]
pub struct UpdateAccessPolicyChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_access_policy_name: Option<String>,

    #[diesel(column_name = subject_type)]
    pub new_access_policy_subject_type: Option<SubjectType>,

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
    pub new_access_policy_effect: Option<Effect>,
}

impl AccessPolicy {
    #[tracing::instrument(level = "trace")]
    fn new(
        name: &str,
        owner_id: FilezUserId,
        subject_type: SubjectType,
        subject_id: AccessPolicySubjectId,
        context_app_ids: Vec<MowsAppId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        actions: Vec<AccessPolicyAction>,
        effect: Effect,
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
            // Phase-2 defaults: Single scope (historic behaviour),
            // unrevoked, never-expiring, not part of a bundle. The
            // Picker (CONSENT_FLOW.md) overrides these as needed.
            resource_scope: mows_auth_core::types::ResourceScope::Single,
            expires_at: None,
            revoked: false,
            policy_bundle_id: None,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        name: &str,
        owner_id: FilezUserId,
        subject_type: SubjectType,
        subject_id: AccessPolicySubjectId,
        context_app_ids: Vec<MowsAppId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
        actions: Vec<AccessPolicyAction>,
        effect: Effect,
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

    /// Lists all resource ids the requesting user has access to for a
    /// specific resource type. Thin adapter on top of
    /// [`mows_auth_core::list_visible_resource_ids`] —
    /// `FilezPolicyStore::list_visible_resource_ids` does the actual
    /// SQL; the engine folds the resulting `(id, effect)` pairs into
    /// the final allow-minus-deny set (LISTING.md §3).
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_all_resources_with_user_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        resource_type: AccessPolicyResourceType,
        action_to_perform: AccessPolicyAction,
    ) -> Result<Vec<Uuid>, FilezError> {
        use mows_auth_core::ResourceTypeRegistry;
        let resource_auth_info = check::engine_resource_registry()
            .lookup(resource_type as u32)
            .expect("resource type registered in engine registry");

        let maybe_user_group_ids = match maybe_requesting_user {
            Some(requesting_user) => {
                Some(UserGroup::get_all_ids_by_user_id(database, &requesting_user.id).await?)
            }
            None => None,
        };

        let subject = match maybe_requesting_user {
            Some(user) => mows_auth_core::Subject::user(
                user.id.0,
                maybe_user_group_ids
                    .as_ref()
                    .map(|gids| gids.iter().map(|g| g.0).collect())
                    .unwrap_or_default(),
            ),
            None => mows_auth_core::Subject::Anonymous,
        };
        let app_view = mows_auth_core::AppView {
            id: requesting_app.id.into(),
            trusted: requesting_app.trusted,
        };
        let store = crate::models::access_policies::store::FilezPolicyStore::new(
            database,
            maybe_requesting_user,
            maybe_user_group_ids.as_ref(),
        );

        let allowed = mows_auth_core::list_visible_resource_ids(
            &store,
            &resource_auth_info,
            &subject,
            app_view,
            action_to_perform as u32,
        )
        .await?;
        Ok(allowed)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_access_policies_with_user_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListAccessPoliciesSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<(Vec<AccessPolicy>, u64), FilezError> {
        let mut connection = database.get_connection().await?;

        let resources_with_access = Self::get_all_resources_with_user_access(
            database,
            maybe_requesting_user,
            requesting_app,
            AccessPolicyResourceType::AccessPolicy,
            AccessPolicyAction::AccessPoliciesList,
        )
        .await?;

        let total_count = resources_with_access.len();

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
            _ => {
                query = query.order_by(schema::access_policies::created_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index.try_into()?);
        }

        if let Some(limit) = limit {
            query = query.limit(limit.try_into()?);
        }

        let access_policies = query.load::<AccessPolicy>(&mut connection).await?;
        Ok((access_policies, total_count.try_into()?))
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

    /// Soft-delete by flipping `revoked = TRUE`. Preserves the row
    /// for audit and lets `PolicyStore` queries exclude it via the
    /// canonical lifecycle filter (`NOT revoked AND …`). The Picker
    /// (CONSENT_FLOW.md "Revocation") and the manager UI both call
    /// this rather than `delete_one`.
    ///
    /// Idempotent: revoking an already-revoked policy succeeds with
    /// zero rows updated.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn revoke_one(database: &Database, id: &Uuid) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::update(
            schema::access_policies::table.filter(schema::access_policies::id.eq(id)),
        )
        .set((
            schema::access_policies::revoked.eq(true),
            schema::access_policies::modified_time.eq(get_current_timestamp()),
        ))
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


#[cfg(test)]
mod context_app_ids_typo_guard {
    //! Regression guard for QA-2: an earlier version of the anonymous
    //! resource-group SQL referenced the singular `context_app_id`
    //! (the actual column is `context_app_ids`, plural). That query
    //! errored at runtime — silently returning zero resource-group
    //! results for every anonymous request, hiding every Public share
    //! via a file-group from anonymous listings.
    //!
    //! The fix lives in the two raw-SQL `format!` blocks above; the
    //! test below greps the file source as a string to catch any
    //! future regression.

    const MOD_RS_SOURCE: &str = include_str!("mod.rs");

    #[test]
    fn no_singular_context_app_id_in_sql_strings() {
        // Compose the forbidden substrings at runtime so the test source
        // doesn't itself contain a literal match (this test file *is*
        // mod.rs — `include_str!` of `self`). Stripping `//` line
        // comments removes the docstring that describes the historical
        // bug; runtime composition handles the assertion expressions.
        let code_only: String = MOD_RS_SOURCE
            .lines()
            .map(|line| {
                let trimmed = line.trim_start();
                if trimmed.starts_with("//") {
                    ""
                } else {
                    line
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        let singular = format!("context_{}", "app_id");
        let forbidden_patterns: [String; 4] = [
            format!("ap.{singular} "),
            format!("ap.{singular}="),
            format!("ap.{singular} @>"),
            format!("access_policies.{singular} "),
        ];
        for forbidden in &forbidden_patterns {
            assert!(
                !code_only.contains(forbidden),
                "regression: a singular `{forbidden}` reappeared in mod.rs — \
                 the column is `context_app_ids` (plural). See \
                 .plans/authorization/issue.md QA-2."
            );
        }
    }

    #[test]
    fn revoke_one_sets_revoked_flag_and_modified_time() {
        // Structural guard for CONSENT_FLOW.md "Revocation": the
        // revoke_one UPDATE must set `revoked = TRUE` (so the
        // PolicyStore lifecycle filter excludes the row from every
        // subsequent check_access) and bump `modified_time`. If a
        // refactor weakens either, this test fires before the change
        // ever reaches production.
        use diesel::{debug_query, pg::Pg, ExpressionMethods, QueryDsl};
        let query = diesel::update(
            crate::schema::access_policies::table
                .filter(crate::schema::access_policies::id.eq(uuid::Uuid::nil())),
        )
        .set((
            crate::schema::access_policies::revoked.eq(true),
            crate::schema::access_policies::modified_time
                .eq(crate::utils::get_current_timestamp()),
        ));
        let sql = debug_query::<Pg, _>(&query).to_string();
        assert!(
            sql.contains("\"revoked\" = $1"),
            "revoke_one must SET revoked = TRUE: {sql}"
        );
        assert!(
            sql.contains("\"modified_time\" = $2"),
            "revoke_one must also bump modified_time: {sql}"
        );
        assert!(
            sql.contains("\"id\" = $3"),
            "revoke_one must scope its UPDATE to the targeted id: {sql}"
        );
    }

    #[test]
    fn anonymous_resource_group_query_uses_plural_column() {
        // Belt-and-braces: the specific SQL substring we know must
        // stay correct.
        assert!(
            MOD_RS_SOURCE.contains("ap.context_app_ids @> $2"),
            "the anonymous resource-group SQL must filter via \
             `ap.context_app_ids @> $2` — see mod.rs:569 region. If you \
             refactored the query, update this test to match."
        );
    }
}
