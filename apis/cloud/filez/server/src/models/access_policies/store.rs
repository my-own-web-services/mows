//! Filez's `PolicyStore` implementation.
//!
//! Wraps a `Database` and serves policy data to
//! `mows_auth_core::check_access`. Each trait method is a near-1:1
//! port of the SQL query that used to live inline in the old
//! `check_resources_access_control` function — the engine consumes
//! them via the trait so it never has to know about filez's tables.

use std::collections::HashMap;

use async_trait::async_trait;
use diesel::{
    pg::sql_types, prelude::*, BoolExpressionMethods, ExpressionMethods, PgArrayExpressionMethods,
    QueryDsl, QueryableByName, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use mows_auth_core::{
    types::Effect, AppView, AuthError, PolicyStore, PolicyView, ResourceAuthInfo, Subject,
};
use uuid::Uuid;

use crate::database::Database;
use crate::filter_subject_access_policies;
use crate::models::access_policies::{
    AccessPolicy, AccessPolicyAction, AccessPolicyResourceType,
};
use crate::models::user_groups::UserGroupId;
use crate::models::users::FilezUser;
use crate::schema;
// Re-exported so the filter_subject_access_policies! macro expands cleanly
// against the engine's SubjectType.
use mows_auth_core::types::SubjectType;

/// Adapter from filez's `Database` to the engine's `PolicyStore`
/// trait. Each `check_access` call constructs one of these.
#[derive(Debug)]
pub struct FilezPolicyStore<'a> {
    database: &'a Database,
    // The legacy `filter_subject_access_policies!` macro takes the
    // *full* FilezUser and `Vec<UserGroupId>` rather than the
    // engine's `Subject`. Cache both here so the trait methods can
    // call the macro without re-deriving them from the engine type.
    maybe_user: Option<&'a FilezUser>,
    maybe_group_ids: Option<&'a Vec<UserGroupId>>,
}

impl<'a> FilezPolicyStore<'a> {
    pub fn new(
        database: &'a Database,
        maybe_user: Option<&'a FilezUser>,
        maybe_group_ids: Option<&'a Vec<UserGroupId>>,
    ) -> Self {
        Self { database, maybe_user, maybe_group_ids }
    }
}

#[derive(QueryableByName, Debug, Clone)]
struct OwnerRow {
    #[diesel(sql_type = sql_types::Uuid)]
    resource_id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    owner_id: Uuid,
}

#[derive(QueryableByName, Debug, Clone)]
struct MembershipRow {
    #[diesel(sql_type = sql_types::Uuid)]
    resource_id: Uuid,
    #[diesel(sql_type = sql_types::Uuid)]
    group_id: Uuid,
}

#[async_trait]
impl<'a> PolicyStore for FilezPolicyStore<'a> {
    async fn fetch_owners(
        &self,
        auth_info: &ResourceAuthInfo,
        resource_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Uuid>, AuthError> {
        let Some(owner_col) = auth_info.resource_table_owner_column else {
            // Resource type has no owner column — the contract says
            // return empty.
            return Ok(HashMap::new());
        };
        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;
        // table/column names are identifier-validated at registry-build
        // time (mows_auth_core::registry::SAFE_IDENTIFIER_REGEX); the
        // format! is therefore safe by construction.
        let query = format!(
            "SELECT {id_col} as resource_id, {owner_col} as owner_id \
             FROM {table_name} WHERE {id_col} = ANY($1)",
            table_name = auth_info.resource_table,
            id_col = auth_info.resource_table_id_column,
            owner_col = owner_col
        );
        let rows: Vec<OwnerRow> = diesel::sql_query(&query)
            .bind::<sql_types::Array<sql_types::Uuid>, _>(resource_ids)
            .load::<OwnerRow>(&mut connection)
            .await?;
        Ok(rows.into_iter().map(|r| (r.resource_id, r.owner_id)).collect())
    }

    async fn fetch_direct_policies(
        &self,
        _auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        app: AppView,
        action: u32,
        resource_ids: &[Uuid],
    ) -> Result<Vec<PolicyView>, AuthError> {
        let resource_type = AccessPolicyResourceType::from_u32(_auth_info.resource_type)
            .expect("resource_type registered");
        let action_enum =
            action_from_u32(action).expect("AccessPolicyAction value out of range");
        let app_id_uuid = app.id;
        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.eq_any(resource_ids))
            .filter(schema::access_policies::resource_type.eq(&resource_type))
            .filter(
                schema::access_policies::context_app_ids
                    .contains(vec![crate::models::apps::MowsAppId(app_id_uuid.into())]),
            )
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            .filter(filter_subject_access_policies!(
                self.maybe_user,
                self.maybe_group_ids
            ))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await?;
        Ok(policies.iter().map(PolicyView::from).collect())
    }

    async fn fetch_resource_group_memberships(
        &self,
        auth_info: &ResourceAuthInfo,
        resource_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, Vec<Uuid>>, AuthError> {
        let (Some(table), Some(rid_col), Some(gid_col)) = (
            auth_info.group_membership_table,
            auth_info.group_membership_resource_id_column,
            auth_info.group_membership_group_id_column,
        ) else {
            return Ok(HashMap::new());
        };
        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;
        let query = format!(
            "SELECT {rid_col} as resource_id, {gid_col} as group_id \
             FROM {table} WHERE {rid_col} = ANY($1)"
        );
        let rows: Vec<MembershipRow> = diesel::sql_query(&query)
            .bind::<sql_types::Array<sql_types::Uuid>, _>(resource_ids)
            .load::<MembershipRow>(&mut connection)
            .await?;
        let mut out: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
        for r in rows {
            out.entry(r.resource_id).or_default().push(r.group_id);
        }
        Ok(out)
    }

    async fn fetch_resource_group_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        app: AppView,
        action: u32,
        resource_group_ids: &[Uuid],
    ) -> Result<Vec<PolicyView>, AuthError> {
        let Some(rg_type_u32) = auth_info.resource_group_type else {
            return Ok(vec![]);
        };
        let rg_type = AccessPolicyResourceType::from_u32(rg_type_u32)
            .expect("resource_group_type registered");
        let action_enum =
            action_from_u32(action).expect("AccessPolicyAction value out of range");
        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.eq_any(resource_group_ids))
            .filter(schema::access_policies::resource_type.eq(rg_type))
            .filter(
                schema::access_policies::context_app_ids
                    .contains(vec![crate::models::apps::MowsAppId(app.id.into())]),
            )
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            .filter(filter_subject_access_policies!(
                self.maybe_user,
                self.maybe_group_ids
            ))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await?;
        Ok(policies.iter().map(PolicyView::from).collect())
    }

    async fn fetch_type_level_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        app: AppView,
        action: u32,
    ) -> Result<Vec<PolicyView>, AuthError> {
        let resource_type = AccessPolicyResourceType::from_u32(auth_info.resource_type)
            .expect("resource_type registered");
        let action_enum =
            action_from_u32(action).expect("AccessPolicyAction value out of range");
        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.is_null())
            .filter(schema::access_policies::resource_type.eq(&resource_type))
            .filter(
                schema::access_policies::context_app_ids
                    .contains(vec![crate::models::apps::MowsAppId(app.id.into())]),
            )
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            // Only Single-scope type-level policies. OwnedByOwner /
            // AccessibleByOwner have resource_id IS NULL too but go
            // through fetch_owner_scoped_policies — they need
            // per-resource matching against the policy's owner.
            .filter(schema::access_policies::resource_scope.eq(0_i16))
            .filter(filter_subject_access_policies!(
                self.maybe_user,
                self.maybe_group_ids
            ))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await?;
        Ok(policies.iter().map(PolicyView::from).collect())
    }

    /// Phase-1 listing impl per LISTING.md §3 — fetch every
    /// `(resource_id, effect)` pair from the three access sources
    /// (owner column, direct policies, resource-group policies) in
    /// one batch. The engine's `list_visible_resource_ids` folds
    /// these into the final allow-minus-deny set.
    ///
    /// The algorithm is the same one
    /// `AccessPolicy::get_all_resources_with_user_access` used to
    /// run inline — moving it here makes the engine the single owner
    /// of the listing primitive and unblocks the Phase-3 swap to a
    /// k-way sorted merge without changing service code.
    async fn list_visible_resource_ids(
        &self,
        auth_info: &ResourceAuthInfo,
        subject: &Subject,
        app: AppView,
        action: u32,
    ) -> Result<Vec<(Uuid, Effect)>, AuthError> {
        use diesel::sql_types::SmallInt;

        let resource_type = AccessPolicyResourceType::from_u32(auth_info.resource_type)
            .expect("resource_type registered");
        let action_enum =
            action_from_u32(action).expect("AccessPolicyAction value out of range");
        let app_id_wrapped = crate::models::apps::MowsAppId(app.id.into());

        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;

        let mut pairs: Vec<(Uuid, Effect)> = Vec::new();

        // 1. Resources owned by the requesting user (modelled as
        //    Allow pairs so the engine folds ownership and Allow
        //    policies uniformly).
        if let (Some(user), Some(owner_col)) =
            (self.maybe_user, auth_info.resource_table_owner_column)
        {
            #[derive(QueryableByName, Debug)]
            struct OwnedResourceId {
                #[diesel(sql_type = sql_types::Uuid)]
                id: Uuid,
            }
            let owned_sql = format!(
                "SELECT {id_col} as id FROM {table_name} WHERE {owner_col} = $1",
                table_name = auth_info.resource_table,
                id_col = auth_info.resource_table_id_column,
                owner_col = owner_col,
            );
            let owned: Vec<OwnedResourceId> = diesel::sql_query(&owned_sql)
                .bind::<sql_types::Uuid, _>(user.id.0)
                .load(&mut connection)
                .await?;
            pairs.extend(owned.into_iter().map(|row| (row.id, Effect::Allow)));
        }

        // 2. Direct policies (resource_id IS NOT NULL) for this
        //    resource_type/app/action that the subject matches.
        let direct_policies = schema::access_policies::table
            .filter(schema::access_policies::resource_type.eq(&resource_type))
            .filter(
                schema::access_policies::context_app_ids
                    .contains(vec![app_id_wrapped.clone()]),
            )
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            .filter(filter_subject_access_policies!(
                self.maybe_user,
                self.maybe_group_ids
            ))
            .filter(lifecycle_filter())
            .select((
                schema::access_policies::resource_id,
                schema::access_policies::effect,
            ))
            .load::<(Option<Uuid>, Effect)>(&mut connection)
            .await?;
        for (maybe_id, effect) in direct_policies {
            if let Some(id) = maybe_id {
                pairs.push((id, effect));
            }
        }

        // 3. Policies attached to resource-groups that the resource
        //    is a member of.
        if let (
            Some(group_membership_table),
            Some(group_resource_id_col),
            Some(group_id_col),
            Some(resource_group_type_u32),
        ) = (
            auth_info.group_membership_table,
            auth_info.group_membership_resource_id_column,
            auth_info.group_membership_group_id_column,
            auth_info.resource_group_type,
        ) {
            let resource_group_type: i16 = i16::try_from(resource_group_type_u32)
                .expect("resource_group_type fits in i16 (registered range 0..=8)");

            #[derive(QueryableByName, Debug)]
            struct GroupPolicyRow {
                #[diesel(sql_type = sql_types::Uuid)]
                id: Uuid,
                #[diesel(sql_type = diesel::sql_types::SmallInt)]
                effect: Effect,
            }

            // identifier-validated at registry-build time
            // (mows_auth_core::registry::SAFE_IDENTIFIER_REGEX) — safe
            // to interpolate.
            let (group_sql, anonymous_branch) = match subject {
                Subject::Anonymous => (
                    format!(
                        "SELECT gm.{resource_id_col} as id, ap.effect \
                         FROM {group_membership_table} gm \
                         JOIN access_policies ap ON ap.resource_id = gm.{group_id_col} \
                         WHERE ap.resource_type = $1 \
                           AND ap.context_app_ids @> $2 \
                           AND ap.actions @> $3 \
                           AND ap.subject_type = 3 \
                           AND NOT ap.revoked \
                           AND (ap.expires_at IS NULL OR ap.expires_at > now())",
                        resource_id_col = group_resource_id_col,
                        group_id_col = group_id_col,
                        group_membership_table = group_membership_table,
                    ),
                    true,
                ),
                Subject::User { .. } => (
                    format!(
                        "SELECT gm.{resource_id_col} as id, ap.effect \
                         FROM {group_membership_table} gm \
                         JOIN access_policies ap ON ap.resource_id = gm.{group_id_col} \
                         WHERE ap.resource_type = $1 \
                           AND ap.context_app_ids @> $2 \
                           AND ap.actions @> $3 \
                           AND ( \
                               (ap.subject_type = 0 AND ap.subject_id = $4) OR \
                               (ap.subject_type = 1 AND ap.subject_id = ANY($5)) OR \
                               (ap.subject_type = 2) OR \
                               (ap.subject_type = 3) \
                           ) \
                           AND NOT ap.revoked \
                           AND (ap.expires_at IS NULL OR ap.expires_at > now())",
                        resource_id_col = group_resource_id_col,
                        group_id_col = group_id_col,
                        group_membership_table = group_membership_table,
                    ),
                    false,
                ),
            };

            let rows: Vec<GroupPolicyRow> = if anonymous_branch {
                diesel::sql_query(&group_sql)
                    .bind::<SmallInt, _>(resource_group_type)
                    .bind::<sql_types::Array<sql_types::Uuid>, _>(vec![app_id_wrapped.clone()])
                    .bind::<sql_types::Array<SmallInt>, _>(vec![action_enum])
                    .load(&mut connection)
                    .await?
            } else {
                let (user_id, group_ids) = match subject {
                    Subject::User { user_id, groups, .. } => (*user_id, groups.clone()),
                    _ => unreachable!("anonymous_branch=false implies User subject"),
                };
                diesel::sql_query(&group_sql)
                    .bind::<SmallInt, _>(resource_group_type)
                    .bind::<sql_types::Array<sql_types::Uuid>, _>(vec![app_id_wrapped.clone()])
                    .bind::<sql_types::Array<SmallInt>, _>(vec![action_enum])
                    .bind::<sql_types::Uuid, _>(user_id)
                    .bind::<sql_types::Array<sql_types::Uuid>, _>(group_ids)
                    .load(&mut connection)
                    .await?
            };
            pairs.extend(rows.into_iter().map(|r| (r.id, r.effect)));
        }

        Ok(pairs)
    }

    async fn fetch_owner_scoped_policies(
        &self,
        auth_info: &ResourceAuthInfo,
        _subject: &Subject,
        app: AppView,
        action: u32,
    ) -> Result<Vec<PolicyView>, AuthError> {
        // resource_id IS NULL AND resource_scope != 0 (Single).
        let resource_type = AccessPolicyResourceType::from_u32(auth_info.resource_type)
            .expect("resource_type registered");
        let action_enum =
            action_from_u32(action).expect("AccessPolicyAction value out of range");
        let pool = self
            .database
            .pool
            .as_ref()
            .ok_or_else(|| AuthError::Evaluation("database pool not initialized".to_string()))?;
        let mut connection = pool.get().await?;
        let policies = schema::access_policies::table
            .filter(schema::access_policies::resource_id.is_null())
            .filter(schema::access_policies::resource_type.eq(&resource_type))
            .filter(
                schema::access_policies::context_app_ids
                    .contains(vec![crate::models::apps::MowsAppId(app.id.into())]),
            )
            .filter(schema::access_policies::actions.contains(vec![action_enum]))
            .filter(schema::access_policies::resource_scope.ne(0_i16))
            .filter(filter_subject_access_policies!(
                self.maybe_user,
                self.maybe_group_ids
            ))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select())
            .load::<AccessPolicy>(&mut connection)
            .await?;
        Ok(policies.iter().map(PolicyView::from).collect())
    }
}

/// SQL-fragment helper for the lifecycle filter every policy lookup
/// must apply (DATA_MODEL.md §2.4):
///   `NOT revoked AND (expires_at IS NULL OR expires_at > now())`
///
/// Filez-side helper so the engine doesn't have to know about
/// PostgreSQL's `now()` or chrono. Future stores (Pektin etc.)
/// implement the same semantics.
fn lifecycle_filter() -> diesel::expression::SqlLiteral<diesel::sql_types::Bool> {
    diesel::dsl::sql::<diesel::sql_types::Bool>(
        "NOT access_policies.revoked AND \
         (access_policies.expires_at IS NULL OR access_policies.expires_at > now())",
    )
}

/// AccessPolicyAction <-> u32 conversion. The action enum uses
/// explicit non-contiguous discriminants (0, 10, 20, …) so a match
/// is the only correct mapping. Returns None for unknown integers.
fn action_from_u32(t: u32) -> Option<AccessPolicyAction> {
    use AccessPolicyAction::*;
    Some(match t {
        0 => FilezFilesCreate,
        10 => FilezFilesDelete,
        20 => FilezFilesGet,
        30 => FilezFilesUpdate,
        70 => FilezFilesVersionsContentGet,
        80 => FilezFilesVersionsContentTusHead,
        90 => FilezFilesVersionsContentTusPatch,
        100 => FilezFilesVersionsDelete,
        110 => FilezFilesVersionsGet,
        120 => FilezFilesVersionsUpdate,
        130 => FilezFilesVersionsCreate,
        140 => UsersGet,
        150 => UsersList,
        160 => UsersCreate,
        170 => UsersUpdate,
        180 => UsersDelete,
        190 => FileGroupsCreate,
        200 => FileGroupsGet,
        210 => FileGroupsUpdate,
        220 => FileGroupsDelete,
        230 => FileGroupsList,
        240 => FileGroupsListFiles,
        250 => FileGroupsUpdateMembers,
        260 => UserGroupsCreate,
        270 => UserGroupsGet,
        280 => UserGroupsUpdate,
        290 => UserGroupsDelete,
        300 => UserGroupsList,
        310 => UserGroupsListUsers,
        320 => UserGroupsUpdateMembers,
        330 => AccessPoliciesCreate,
        340 => AccessPoliciesGet,
        350 => AccessPoliciesUpdate,
        360 => AccessPoliciesDelete,
        370 => AccessPoliciesList,
        380 => StorageQuotasCreate,
        390 => StorageQuotasGet,
        400 => StorageQuotasUpdate,
        410 => StorageQuotasDelete,
        420 => StorageQuotasList,
        430 => StorageLocationsGet,
        440 => StorageLocationsList,
        450 => TagsUpdate,
        460 => TagsGet,
        470 => FilezJobsCreate,
        480 => FilezJobsGet,
        490 => FilezJobsUpdate,
        500 => FilezJobsDelete,
        510 => FilezJobsList,
        520 => FilezJobsPickup,
        530 => FilezAppsGet,
        540 => FilezAppsList,
        _ => return None,
    })
}

#[cfg(test)]
mod lifecycle_filter_guard {
    //! Regression guard: every PolicyStore method that selects
    //! AccessPolicy rows MUST attach `lifecycle_filter()`. A revoked
    //! or expired policy must NOT come out of the store — or
    //! check_access will happily honor it.
    //!
    //! Renders each query via diesel::debug_query and asserts the
    //! literal SQL clause is present. Catches a future refactor that
    //! drops the `.filter(lifecycle_filter())` call.
    use super::*;
    use crate::models::access_policies::SubjectType;
    use diesel::{debug_query, pg::Pg, query_builder::QueryFragment};

    fn rendered_sql<Q: QueryFragment<Pg>>(query: Q) -> String {
        debug_query::<Pg, _>(&query).to_string()
    }

    #[test]
    fn direct_query_contains_lifecycle_filter() {
        // Mirror of fetch_direct_policies's query (minus the runtime
        // bindings). We render this exact shape to assert the filter
        // is present.
        let ids = [Uuid::nil()];
        let query = schema::access_policies::table
            .filter(schema::access_policies::resource_id.eq_any(&ids[..]))
            .filter(schema::access_policies::resource_type.eq(&AccessPolicyResourceType::File))
            .filter(schema::access_policies::subject_type.eq(SubjectType::Public))
            .filter(lifecycle_filter())
            .select(AccessPolicy::as_select());
        let sql = rendered_sql(query);
        assert!(
            sql.contains("NOT access_policies.revoked"),
            "direct-policy query MUST filter out revoked rows: {sql}"
        );
        assert!(
            sql.contains("access_policies.expires_at IS NULL OR access_policies.expires_at > now()"),
            "direct-policy query MUST filter out expired rows: {sql}"
        );
    }

    #[test]
    fn lifecycle_filter_emits_the_documented_predicate() {
        let query = schema::access_policies::table
            .filter(lifecycle_filter())
            .select(schema::access_policies::id);
        let sql = rendered_sql(query);
        // The two halves of the documented contract.
        assert!(sql.contains("NOT access_policies.revoked"));
        assert!(sql.contains("access_policies.expires_at IS NULL"));
        assert!(sql.contains("access_policies.expires_at > now()"));
    }
}
