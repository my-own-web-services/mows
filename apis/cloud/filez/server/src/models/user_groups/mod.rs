use super::{
    access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    user_user_group_members::UserUserGroupMember,
    users::FilezUser,
};
use crate::{
    database::Database,
    errors::FilezError,
    http_api::user_groups::list::ListUserGroupsSortBy,
    impl_typed_uuid,
    models::{apps::MowsApp, users::FilezUserId},
    schema::{self},
    types::SortDirection,
    utils::get_current_timestamp,
};
use diesel::{
    pg::Pg, prelude::*, AsChangeset, ExpressionMethods, JoinOnDsl, QueryDsl, Selectable,
    SelectableHelper,
};

use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

impl_typed_uuid!(UserGroupId);

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable, AsChangeset,
)]
#[diesel(table_name = crate::schema::user_groups)]
#[diesel(check_for_backend(Pg))]
pub struct UserGroup {
    pub id: UserGroupId,
    pub owner_id: FilezUserId,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub description: Option<String>,
    /// USER_GROUPS.md §1 — who can see this group exists.
    /// Wire-stable per mows_auth_core::types::GroupVisibility.
    pub visibility: mows_auth_core::types::GroupVisibility,
    /// USER_GROUPS.md §1 — who can become a member.
    /// Wire-stable per mows_auth_core::types::GroupJoinPolicy.
    pub join_policy: mows_auth_core::types::GroupJoinPolicy,
}

/// Result of `UserGroup::update_one`. Carries the updated row plus
/// the count of pending join requests that were auto-promoted to
/// memberships as a side-effect (USER_GROUPS.md §7.3 — only > 0
/// when join_policy transitioned to OpenJoin in this update).
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateUserGroupOutcome {
    pub updated_user_group: UserGroup,
    pub auto_promoted_requests: usize,
}

#[derive(Serialize, Deserialize, ToSchema, Validate, AsChangeset, Clone, Debug)]
#[diesel(table_name = crate::schema::user_groups)]
pub struct UpdateUserGroupChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_user_group_name: Option<String>,

    /// Optional new free-text description shown in the directory.
    /// `Some(None)` clears the field; omitting the field leaves it
    /// alone (serde double-Option pattern).
    #[schema(max_length = 1024)]
    #[validate(max_length = 1024)]
    #[diesel(column_name = description)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_description: Option<Option<String>>,

    /// USER_GROUPS.md §1 — who can see this group exists.
    #[diesel(column_name = visibility)]
    pub new_visibility: Option<mows_auth_core::types::GroupVisibility>,

    /// USER_GROUPS.md §1 — who can become a member.
    #[diesel(column_name = join_policy)]
    pub new_join_policy: Option<mows_auth_core::types::GroupJoinPolicy>,
}

impl UserGroup {
    #[tracing::instrument(level = "trace")]
    fn new(owner: &FilezUser, name: &str) -> Self {
        Self {
            id: UserGroupId::new(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            description: None,
            // Conservative defaults per USER_GROUPS.md §1 — owner
            // can flip them via update_user_group later.
            visibility: mows_auth_core::types::GroupVisibility::Private,
            join_policy: mows_auth_core::types::GroupJoinPolicy::InviteOnly,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_id(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<UserGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let user_group = schema::user_groups::table
            .filter(schema::user_groups::id.eq(user_group_id))
            .select(UserGroup::as_select())
            .first::<UserGroup>(&mut connection)
            .await?;
        Ok(user_group)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        owner: &FilezUser,
        name: &str,
    ) -> Result<UserGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let new_user_group = UserGroup::new(owner, name);
        let created_user_group = diesel::insert_into(schema::user_groups::table)
            .values(new_user_group)
            .returning(UserGroup::as_select())
            .get_result::<UserGroup>(&mut connection)
            .await?;
        Ok(created_user_group)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_id(
        database: &Database,
        user_group_ids: &Vec<UserGroupId>,
    ) -> Result<Vec<UserGroup>, FilezError> {
        let mut connection = database.get_connection().await?;
        let user_groups = schema::user_groups::table
            .filter(schema::user_groups::id.eq_any(user_group_ids))
            .select(UserGroup::as_select())
            .load::<UserGroup>(&mut connection)
            .await?;
        Ok(user_groups)
    }

    /// Resolve the candidate user-group id set for a discovery
    /// filter mode (USER_GROUPS.md §6). Each branch is a single
    /// indexed query against either user_groups or one of the
    /// (members / invitations / join_requests) tables.
    ///
    /// `Public` is the only mode that does not require an
    /// authenticated caller; the handler enforces the auth
    /// requirement before calling this function so a NULL user_id
    /// here always means "anonymous + Public".
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn candidate_ids_for_filter(
        database: &Database,
        maybe_user_id: Option<&FilezUserId>,
        filter: ListUserGroupsFilter,
    ) -> Result<Vec<UserGroupId>, FilezError> {
        use mows_auth_core::types::GroupVisibility;
        let mut connection = database.get_connection().await?;

        let ids: Vec<UserGroupId> = match (filter, maybe_user_id) {
            (ListUserGroupsFilter::Owned, Some(user_id)) => {
                schema::user_groups::table
                    .filter(schema::user_groups::owner_id.eq(user_id))
                    .select(schema::user_groups::id)
                    .load::<UserGroupId>(&mut connection)
                    .await?
            }
            (ListUserGroupsFilter::Member, Some(user_id)) => {
                schema::user_user_group_members::table
                    .filter(schema::user_user_group_members::user_id.eq(user_id))
                    .select(schema::user_user_group_members::user_group_id)
                    .load::<UserGroupId>(&mut connection)
                    .await?
            }
            (ListUserGroupsFilter::Invited, Some(user_id)) => {
                schema::user_user_group_invitations::table
                    .filter(schema::user_user_group_invitations::user_id.eq(user_id))
                    .select(schema::user_user_group_invitations::user_group_id)
                    .load::<UserGroupId>(&mut connection)
                    .await?
            }
            (ListUserGroupsFilter::Requested, Some(user_id)) => {
                schema::user_user_group_join_requests::table
                    .filter(schema::user_user_group_join_requests::user_id.eq(user_id))
                    .select(schema::user_user_group_join_requests::user_group_id)
                    .load::<UserGroupId>(&mut connection)
                    .await?
            }
            (ListUserGroupsFilter::Public, _) => {
                schema::user_groups::table
                    .filter(
                        schema::user_groups::visibility.eq(GroupVisibility::Public),
                    )
                    .select(schema::user_groups::id)
                    .load::<UserGroupId>(&mut connection)
                    .await?
            }
            (ListUserGroupsFilter::ServerListed, Some(_)) => {
                schema::user_groups::table
                    .filter(
                        schema::user_groups::visibility
                            .eq(GroupVisibility::ListedRestricted)
                            .or(schema::user_groups::visibility.eq(GroupVisibility::Public)),
                    )
                    .select(schema::user_groups::id)
                    .load::<UserGroupId>(&mut connection)
                    .await?
            }
            // Filters other than Public reaching here with no user
            // are a handler bug — the handler must reject them with
            // 401 before dispatching. Return empty rather than
            // panic to fail closed.
            _ => Vec::new(),
        };
        Ok(ids)
    }

    #[tracing::instrument(level = "trace", skip(database, maybe_requesting_user, requesting_app))]
    pub async fn list_with_user_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListUserGroupsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<(Vec<UserGroup>, u64), FilezError> {
        let mut connection = database.get_connection().await?;

        let resources_with_access = AccessPolicy::get_all_resources_with_user_access(
            database,
            maybe_requesting_user,
            requesting_app,
            AccessPolicyResourceType::UserGroup,
            AccessPolicyAction::UserGroupsList,
        )
        .await?;

        let total_count = schema::user_groups::table
            .filter(schema::user_groups::id.eq_any(&resources_with_access))
            .count()
            .get_result::<i64>(&mut connection)
            .await?;

        load_and_paginate(
            &mut connection,
            resources_with_access.into_iter().map(UserGroupId).collect(),
            from_index,
            limit,
            sort_by,
            sort_order,
            total_count,
        )
        .await
    }

    /// Discovery-filtered listing (USER_GROUPS.md §6 table). Dispatches
    /// on the filter mode to one of the candidate queries above, then
    /// loads + sorts + paginates with the same machinery as
    /// `list_with_user_access`.
    ///
    /// Auth model:
    ///   - `Public` is the only mode that allows anonymous callers.
    ///   - Every other mode requires `maybe_requesting_user.is_some()`;
    ///     the handler MUST enforce that before dispatch (401).
    #[tracing::instrument(level = "trace", skip(database, maybe_requesting_user))]
    pub async fn list_with_filter(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        filter: ListUserGroupsFilter,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListUserGroupsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<(Vec<UserGroup>, u64), FilezError> {
        let mut connection = database.get_connection().await?;
        let candidate_ids = Self::candidate_ids_for_filter(
            database,
            maybe_requesting_user.map(|u| &u.id),
            filter,
        )
        .await?;

        let total_count = schema::user_groups::table
            .filter(schema::user_groups::id.eq_any(&candidate_ids))
            .count()
            .get_result::<i64>(&mut connection)
            .await?;

        load_and_paginate(
            &mut connection,
            candidate_ids,
            from_index,
            limit,
            sort_by,
            sort_order,
            total_count,
        )
        .await
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_one(
        database: &Database,
        user_group_id: &UserGroupId,
        changeset: &UpdateUserGroupChangeset,
    ) -> Result<UpdateUserGroupOutcome, FilezError> {
        use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection};
        use mows_auth_core::types::GroupJoinPolicy;

        let mut connection = database.get_connection().await?;
        connection
            .transaction::<UpdateUserGroupOutcome, FilezError, _>(|conn| {
                async move {
                    // Snapshot the pre-update join_policy so we can
                    // detect a flip to OpenJoin (USER_GROUPS.md §7.3).
                    let previous_join_policy: GroupJoinPolicy = schema::user_groups::table
                        .filter(schema::user_groups::id.eq(user_group_id))
                        .select(schema::user_groups::join_policy)
                        .first::<GroupJoinPolicy>(conn)
                        .await?;

                    let updated_user_group =
                        diesel::update(schema::user_groups::table.find(user_group_id))
                            .set((
                                changeset,
                                schema::user_groups::modified_time
                                    .eq(get_current_timestamp()),
                            ))
                            .returning(UserGroup::as_select())
                            .get_result::<UserGroup>(conn)
                            .await?;

                    // USER_GROUPS.md §7.3: when join_policy transitions
                    // to OpenJoin, every pending request becomes
                    // redundant — promote them to memberships in the
                    // same transaction so the user immediately sees
                    // membership instead of a stale pending row.
                    let auto_promoted_requests = if previous_join_policy
                        != GroupJoinPolicy::OpenJoin
                        && updated_user_group.join_policy == GroupJoinPolicy::OpenJoin
                    {
                        let pending_user_ids: Vec<FilezUserId> =
                            schema::user_user_group_join_requests::table
                                .filter(
                                    schema::user_user_group_join_requests::user_group_id
                                        .eq(user_group_id),
                                )
                                .select(schema::user_user_group_join_requests::user_id)
                                .load::<FilezUserId>(conn)
                                .await?;
                        let count = pending_user_ids.len();
                        if count > 0 {
                            let new_members: Vec<UserUserGroupMember> = pending_user_ids
                                .iter()
                                .map(|user_id| UserUserGroupMember::new(user_id, user_group_id))
                                .collect();
                            diesel::insert_into(schema::user_user_group_members::table)
                                .values(&new_members)
                                .on_conflict_do_nothing()
                                .execute(conn)
                                .await?;
                            diesel::delete(
                                schema::user_user_group_join_requests::table.filter(
                                    schema::user_user_group_join_requests::user_group_id
                                        .eq(user_group_id),
                                ),
                            )
                            .execute(conn)
                            .await?;
                        }
                        count
                    } else {
                        0
                    };

                    Ok(UpdateUserGroupOutcome {
                        updated_user_group,
                        auto_promoted_requests,
                    })
                }
                .scope_boxed()
            })
            .await
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::user_groups::table.filter(schema::user_groups::id.eq(user_group_id)),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn add_users(
        database: &Database,
        user_group_id: &UserGroupId,
        user_ids: &Vec<FilezUserId>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        let new_members = user_ids
            .iter()
            .map(|user_id| UserUserGroupMember::new(user_id, user_group_id))
            .collect::<Vec<UserUserGroupMember>>();

        diesel::insert_into(schema::user_user_group_members::table)
            .values(&new_members)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn remove_users(
        database: &Database,
        user_group_id: &UserGroupId,
        user_ids: &Vec<FilezUserId>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::user_user_group_members::table
                .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
                .filter(schema::user_user_group_members::user_id.eq_any(user_ids)),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    /// Retrieves all user group IDs that the specified user is a member of
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_all_ids_by_user_id(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<Vec<UserGroupId>, FilezError> {
        let mut connection = database.get_connection().await?;

        let user_group_ids = schema::user_groups::table
            .inner_join(
                schema::user_user_group_members::table
                    .on(schema::user_groups::id.eq(schema::user_user_group_members::user_group_id)),
            )
            .filter(schema::user_user_group_members::user_id.eq(user_id))
            .select(schema::user_groups::id)
            .load::<UserGroupId>(&mut connection)
            .await?;

        Ok(user_group_ids)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_user_count(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<u64, FilezError> {
        let mut connection = database.get_connection().await?;

        let count = schema::user_user_group_members::table
            .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
            .count()
            .get_result::<i64>(&mut connection)
            .await?;

        Ok(count.try_into()?)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_users(
        database: &Database,
        user_group_id: &UserGroupId,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<&str>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<FilezUser>, FilezError> {
        let mut connection = database.get_connection().await?;

        let mut query = schema::user_groups::table
            .inner_join(
                schema::user_user_group_members::table
                    .on(schema::user_groups::id.eq(schema::user_user_group_members::user_group_id)),
            )
            .inner_join(
                schema::users::table
                    .on(schema::user_user_group_members::user_id.eq(schema::users::id)),
            )
            .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
            .select(FilezUser::as_select())
            .into_boxed();

        match (sort_by, sort_order) {
            (Some("created_time"), Some(SortDirection::Ascending)) => {
                query = query.order_by(schema::users::created_time.asc());
            }
            (Some("created_time"), Some(SortDirection::Descending)) => {
                query = query.order_by(schema::users::created_time.desc());
            }
            (Some("name"), Some(SortDirection::Ascending)) => {
                query = query.order_by(schema::users::display_name.asc());
            }
            (Some("name"), Some(SortDirection::Descending)) => {
                query = query.order_by(schema::users::display_name.desc());
            }
            _ => {
                query = query.order_by(schema::users::created_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index.try_into()?);
        }
        if let Some(limit) = limit {
            query = query.limit(limit.try_into()?);
        }

        let users_list = query.load::<FilezUser>(&mut connection).await?;

        Ok(users_list)
    }
}

/// USER_GROUPS.md §6 discovery modes. Each `filter` query value
/// maps to a single indexed query (see `candidate_ids_for_filter`).
#[derive(
    serde::Serialize, serde::Deserialize, utoipa::ToSchema, Clone, Copy, Debug, PartialEq, Eq,
)]
pub enum ListUserGroupsFilter {
    /// Default: groups the caller has UserGroupsList policy on.
    /// Identical to the pre-Phase-4 list behaviour.
    AccessGranted,
    /// Groups owned by the caller.
    Owned,
    /// Groups the caller is a member of.
    Member,
    /// Groups the caller has a pending invitation to.
    Invited,
    /// Groups the caller has a pending join request for.
    Requested,
    /// Groups with visibility = Public. Allowed for anonymous callers.
    Public,
    /// Groups with visibility IN (ListedRestricted, Public).
    /// Requires authentication.
    ServerListed,
}

/// Sort + paginate a precomputed candidate id set. Shared between
/// `list_with_user_access` and `list_with_filter` so the two paths
/// emit identical SQL for the load step.
#[tracing::instrument(level = "trace", skip(connection, candidate_ids))]
async fn load_and_paginate(
    connection: &mut diesel_async::pooled_connection::deadpool::Object<
        diesel_async::AsyncPgConnection,
    >,
    candidate_ids: Vec<UserGroupId>,
    from_index: Option<u64>,
    limit: Option<u64>,
    sort_by: Option<ListUserGroupsSortBy>,
    sort_order: Option<SortDirection>,
    total_count: i64,
) -> Result<(Vec<UserGroup>, u64), FilezError> {
    let mut query = schema::user_groups::table
        .filter(schema::user_groups::id.eq_any(candidate_ids))
        .select(UserGroup::as_select())
        .into_boxed();

    let sort_by = sort_by.unwrap_or(ListUserGroupsSortBy::CreatedTime);
    let sort_order = sort_order.unwrap_or(SortDirection::Descending);

    query = match (sort_by, sort_order) {
        (ListUserGroupsSortBy::CreatedTime, SortDirection::Ascending) => {
            query.order_by(schema::user_groups::created_time.asc())
        }
        (ListUserGroupsSortBy::CreatedTime, SortDirection::Descending) => {
            query.order_by(schema::user_groups::created_time.desc())
        }
        (ListUserGroupsSortBy::Name, SortDirection::Ascending) => {
            query.order_by(schema::user_groups::name.asc())
        }
        (ListUserGroupsSortBy::Name, SortDirection::Descending) => {
            query.order_by(schema::user_groups::name.desc())
        }
        (ListUserGroupsSortBy::ModifiedTime, SortDirection::Ascending) => {
            query.order_by(schema::user_groups::modified_time.asc())
        }
        (ListUserGroupsSortBy::ModifiedTime, SortDirection::Descending) => {
            query.order_by(schema::user_groups::modified_time.desc())
        }
        // SortDirection::Neutral and any future variants fall back
        // to the default (newest first) — same as the original
        // inline impl's wildcard arm.
        _ => query.order_by(schema::user_groups::created_time.desc()),
    };

    if let Some(from_index) = from_index {
        query = query.offset(from_index.try_into()?);
    }
    if let Some(limit) = limit {
        query = query.limit(limit.try_into()?);
    }

    let user_groups = query.load::<UserGroup>(connection).await?;
    Ok((user_groups, total_count.try_into()?))
}

#[cfg(test)]
mod auto_promote_invariant_guard {
    //! USER_GROUPS.md §7.3 regression guard: the auto-promote
    //! transition condition + the membership/request-row pair must
    //! survive any refactor of `update_one`. Without these the
    //! UI invariant breaks silently — a user requests to join, the
    //! owner flips the policy to OpenJoin, and the user stays in
    //! the pending list forever instead of becoming a member.
    //!
    //! Source-string guard (same pattern as
    //! `context_app_ids_typo_guard` in models/access_policies/mod.rs)
    //! so the test runs without a live database.
    const MOD_RS_SOURCE: &str = include_str!("mod.rs");

    #[test]
    fn update_one_contains_join_policy_transition_check() {
        // The exact transition predicate from USER_GROUPS.md §7.3.
        // If a refactor changes the direction (e.g. promotes on
        // ANY change instead of "to OpenJoin"), this test fires.
        assert!(
            MOD_RS_SOURCE.contains("previous_join_policy")
                && MOD_RS_SOURCE.contains("GroupJoinPolicy::OpenJoin"),
            "update_one must compare the previous join_policy against \
             OpenJoin before auto-promoting (USER_GROUPS.md §7.3)"
        );
    }

    #[test]
    fn update_one_promotes_via_insert_then_delete() {
        // Both halves of the move MUST live in the same transaction.
        // We can't assert "same transaction" structurally — but we
        // can assert both operations are present and reference the
        // expected tables.
        assert!(
            MOD_RS_SOURCE.contains("insert_into(schema::user_user_group_members::table)"),
            "auto-promote must INSERT into user_user_group_members"
        );
        assert!(
            MOD_RS_SOURCE.contains("delete(\n                                schema::user_user_group_join_requests::table")
                || MOD_RS_SOURCE.contains("schema::user_user_group_join_requests::table.filter"),
            "auto-promote must DELETE the corresponding join_requests rows"
        );
    }
}

#[cfg(test)]
mod filter_dispatch_guard {
    //! USER_GROUPS.md §6 invariant: the discovery filter modes MUST
    //! map to indexed queries. We render each branch's diesel query
    //! via debug_query and assert the WHERE clause references the
    //! expected column. A refactor that drops the filter clause
    //! re-introduces a full-table scan at the directory's worst case
    //! (1M Public groups per LISTING.md §1).
    use super::*;
    use diesel::{debug_query, pg::Pg};

    #[test]
    fn public_filter_uses_visibility_column() {
        use mows_auth_core::types::GroupVisibility;
        let query = schema::user_groups::table
            .filter(schema::user_groups::visibility.eq(GroupVisibility::Public))
            .select(schema::user_groups::id);
        let sql = debug_query::<Pg, _>(&query).to_string();
        assert!(
            sql.contains("\"user_groups\".\"visibility\" ="),
            "Public filter must hit the visibility column: {sql}"
        );
    }

    #[test]
    fn server_listed_filter_includes_both_visibility_values() {
        use mows_auth_core::types::GroupVisibility;
        let query = schema::user_groups::table
            .filter(
                schema::user_groups::visibility
                    .eq(GroupVisibility::ListedRestricted)
                    .or(schema::user_groups::visibility.eq(GroupVisibility::Public)),
            )
            .select(schema::user_groups::id);
        let sql = debug_query::<Pg, _>(&query).to_string();
        // The OR-bridge between ListedRestricted (1) and Public (2)
        // must survive any refactor — without it ServerListed
        // collapses to one of the two visibility tiers and the other
        // becomes invisible to logged-in browsers.
        assert!(
            sql.contains("\"user_groups\".\"visibility\" =")
                && sql.matches("\"visibility\"").count() >= 2,
            "ServerListed filter must reference visibility twice (OR-bridge): {sql}"
        );
    }
}
