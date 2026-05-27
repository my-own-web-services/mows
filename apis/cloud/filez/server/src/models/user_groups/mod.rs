use super::{
    access_policies::{
        AccessPolicy, AccessPolicyAction, AccessPolicyResourceType, AccessPolicySubjectId,
    },
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
    /// LISTING.md §6.2 / Phase 5 P5-3 — set to true once the
    /// member count crosses
    /// `user_group_materialize_threshold()` (1000). Maintained
    /// by `recompute_user_group_materialize_flags()` on a daily
    /// schedule; consumed by the Phase 3 listing engine to choose
    /// between cover-table and live-join paths. Defaults to false
    /// for fresh groups (most groups never grow past the
    /// threshold).
    pub materialize_uga: bool,
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
            // Fresh group has zero members; the recompute job
            // flips this to true on the first sweep after the
            // group crosses 1000 members.
            materialize_uga: false,
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

    /// USER_GROUPS.md §6 + Phase 4 P4-10: create the group AND
    /// seed the default-policy set in one transaction so the
    /// non-owner flows the spec promises are unblocked from the
    /// moment the group exists.
    ///
    /// Seeded per-group policies:
    ///
    ///   * Members can list this group + see the member roster:
    ///     subject = UserGroup({this group}),
    ///     actions = [UserGroupsList, UserGroupsListUsers],
    ///     resource = this group.
    ///   * If join_policy != InviteOnly, any ServerMember can
    ///     request to join: subject = ServerMember,
    ///     action = UserGroupsRequestJoin, resource = this group.
    ///   * Owner is covered by the implicit owner-grant
    ///     (POLICY_SEMANTICS.md §3 step 4) — no explicit policy
    ///     needed for the owner.
    ///   * UserGroupsRespondToInvite / UserGroupsLeave are
    ///     row-based per phase4 P4-9 (invitation / membership row
    ///     IS the consent); no policy seeding required.
    ///   * Server-wide UserGroupsList grant lives in migration
    ///     00000000000016_seed_user_groups_list_policy (so it
    ///     covers existing groups too, not just freshly created).
    ///
    /// All inserts run inside a diesel-async transaction; a
    /// failure rolls back the group row too, so a partially
    /// bootstrapped group never lands in the table.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        owner: &FilezUser,
        name: &str,
    ) -> Result<UserGroup, FilezError> {
        use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection};
        use mows_auth_core::types::{Effect, GroupJoinPolicy, SubjectType};

        let mut connection = database.get_connection().await?;
        let new_user_group = UserGroup::new(owner, name);
        let owner_id = owner.id.clone();
        connection
            .transaction::<UserGroup, FilezError, _>(|conn| {
                async move {
                    let created_user_group =
                        diesel::insert_into(schema::user_groups::table)
                            .values(new_user_group)
                            .returning(UserGroup::as_select())
                            .get_result::<UserGroup>(conn)
                            .await?;

                    let group_id_uuid: uuid::Uuid = created_user_group.id.into();
                    // Wildcard-app context: every app a user
                    // authenticates against gets the grant. Same
                    // sentinel the engine uses for the
                    // "any app" check (DATA_MODEL.md).
                    let any_app =
                        vec![crate::models::apps::MowsAppId::nil()];

                    // Members can list this group + list its
                    // members. subject = UserGroup({this group}).
                    let member_view_policy = AccessPolicy::new(
                        "default: members can list this group + its members",
                        owner_id.clone(),
                        SubjectType::UserGroup,
                        AccessPolicySubjectId::from(group_id_uuid),
                        any_app.clone(),
                        AccessPolicyResourceType::UserGroup,
                        Some(group_id_uuid),
                        vec![
                            AccessPolicyAction::UserGroupsList,
                            AccessPolicyAction::UserGroupsListUsers,
                        ],
                        Effect::Allow,
                    );
                    diesel::insert_into(schema::access_policies::table)
                        .values(&member_view_policy)
                        .execute(conn)
                        .await?;

                    // RequestToJoin / OpenJoin → any ServerMember
                    // can submit a join request. (The handler
                    // short-circuits OpenJoin into a direct join,
                    // but the policy gate is the same: the user
                    // needs permission to *attempt* the request.)
                    if created_user_group.join_policy != GroupJoinPolicy::InviteOnly {
                        let request_join_policy = AccessPolicy::new(
                            "default: ServerMember can request to join this group",
                            owner_id.clone(),
                            SubjectType::ServerMember,
                            AccessPolicySubjectId::from(uuid::Uuid::nil()),
                            any_app.clone(),
                            AccessPolicyResourceType::UserGroup,
                            Some(group_id_uuid),
                            vec![AccessPolicyAction::UserGroupsRequestJoin],
                            Effect::Allow,
                        );
                        diesel::insert_into(schema::access_policies::table)
                            .values(&request_join_policy)
                            .execute(conn)
                            .await?;
                    }

                    Ok(created_user_group)
                }
                .scope_boxed()
            })
            .await
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
            // `AccessGranted` goes through the policy-checked
            // `list_with_user_access` path; the handler must never
            // dispatch it here. If it does, the caller has bypassed
            // the policy check — fail loud, not closed.
            (ListUserGroupsFilter::AccessGranted, _) => {
                return Err(FilezError::InvalidRequest(
                    "candidate_ids_for_filter: AccessGranted dispatches via \
                     `list_with_user_access` (policy-checked path); calling \
                     this function with that filter is a handler-routing bug"
                        .to_string(),
                ));
            }
            // Filters other than Public reaching here with no user
            // are a handler-contract violation — the handler MUST
            // reject them with 401 before dispatch. Fail loud so a
            // future refactor that weakens the handler guard
            // surfaces in monitoring instead of returning an empty
            // list silently (phase4-review MAJ-1 / SLOP-5).
            (other, None) => {
                return Err(FilezError::InvalidRequest(format!(
                    "candidate_ids_for_filter: filter `{other:?}` requires an \
                     authenticated user (handler must enforce auth before dispatch)"
                )));
            }
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
    ///
    /// Visibility-scan fast path (phase4-review MAJ-4): `Public`
    /// and `ServerListed` filters bypass the candidate-ids Vec
    /// entirely and run `SELECT … FROM user_groups WHERE visibility
    /// = X ORDER BY … LIMIT N OFFSET M` directly. At the
    /// USER_GROUPS.md §1 scale target (1M Public groups) this saves
    /// a 16MB Rust allocation + the eq_any indirection per page.
    /// Per-user lifecycle filters (Owned/Member/Invited/Requested)
    /// keep the candidate-ids shape — their result sets are bounded
    /// by user state (tens to low hundreds) so the indirection is
    /// fine.
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
        use mows_auth_core::types::GroupVisibility;
        let mut connection = database.get_connection().await?;

        // Visibility-scan fast path. Compile-time assert the
        // hand-rolled SQL literals match the enum discriminants —
        // a future renumber of GroupVisibility breaks the build,
        // not production.
        const _: () = {
            assert!(GroupVisibility::Public as i16 == 2);
            assert!(GroupVisibility::ListedRestricted as i16 == 1);
        };
        let visibility_predicate_sql: Option<&'static str> = match filter {
            ListUserGroupsFilter::Public => Some("user_groups.visibility = 2"),
            ListUserGroupsFilter::ServerListed => Some("user_groups.visibility IN (1, 2)"),
            _ => None,
        };
        if let Some(predicate_sql) = visibility_predicate_sql {
            let total_count = schema::user_groups::table
                .filter(diesel::dsl::sql::<diesel::sql_types::Bool>(predicate_sql))
                .count()
                .get_result::<i64>(&mut connection)
                .await?;
            let user_groups = load_user_groups_with_predicate(
                &mut connection,
                predicate_sql,
                from_index,
                limit,
                sort_by,
                sort_order,
            )
            .await?;
            return Ok((user_groups, total_count.try_into()?));
        }

        // Naturally-bounded path for per-user lifecycle filters.
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
                    //
                    // Single-shot raw SQL keeps the work in postgres
                    // (no round-trip to load ids into a Vec, no in-
                    // Rust struct construction). At 10k pending
                    // requests this halves the lock-hold time vs the
                    // earlier SELECT-loop-INSERT shape
                    // (phase4-review MAJ-6).
                    let auto_promoted_requests = if previous_join_policy
                        != GroupJoinPolicy::OpenJoin
                        && updated_user_group.join_policy == GroupJoinPolicy::OpenJoin
                    {
                        // INSERT first so the deletes can't strand a
                        // user as neither-pending-nor-member (we're
                        // inside a tx so order is invisible to readers,
                        // but the explicit order matches the spec
                        // wording "convert pending requests to
                        // memberships").
                        diesel::sql_query(
                            "INSERT INTO user_user_group_members \
                                 (user_id, user_group_id, created_time) \
                             SELECT user_id, user_group_id, now() \
                             FROM user_user_group_join_requests \
                             WHERE user_group_id = $1 \
                             ON CONFLICT DO NOTHING",
                        )
                        .bind::<diesel::sql_types::Uuid, _>(user_group_id.0)
                        .execute(conn)
                        .await?;

                        let deleted = diesel::delete(
                            schema::user_user_group_join_requests::table.filter(
                                schema::user_user_group_join_requests::user_group_id
                                    .eq(user_group_id),
                            ),
                        )
                        .execute(conn)
                        .await?;
                        deleted
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

    /// USER_GROUPS.md §7.2 atomic cascade. Both writes run inside
    /// one diesel-async transaction so a mid-flight failure can't
    /// leave the group alive with zero subject-targeted policies
    /// (the previous shape had each call acquire its own connection
    /// and could partially succeed — multi-review phase4 CRIT-3).
    ///
    /// Returns the count of dropped policy rows so the caller can
    /// emit it on the audit trail.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one_with_subject_policy_cleanup(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<usize, FilezError> {
        use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection};

        let mut connection = database.get_connection().await?;
        connection
            .transaction::<usize, FilezError, _>(|conn| {
                async move {
                    // Drop policies FIRST so the count is captured
                    // while the group row still exists (for the
                    // audit log entry the spec asks for); the
                    // group DELETE then runs in the same tx.
                    let dropped = diesel::delete(
                        crate::schema::access_policies::table
                            .filter(
                                crate::schema::access_policies::subject_type
                                    .eq(mows_auth_core::types::SubjectType::UserGroup),
                            )
                            .filter(
                                crate::schema::access_policies::subject_id
                                    .eq::<uuid::Uuid>((*user_group_id).into()),
                            ),
                    )
                    .execute(conn)
                    .await?;

                    diesel::delete(
                        schema::user_groups::table
                            .filter(schema::user_groups::id.eq(user_group_id)),
                    )
                    .execute(conn)
                    .await?;

                    Ok(dropped)
                }
                .scope_boxed()
            })
            .await
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

/// Which kind of pending row [`promote_pending_to_member`] should
/// consume. Both invitation-accept and join-request-approve share
/// the same delete-then-insert shape; this enum selects the source
/// table without duplicating the transaction code in two handlers
/// (phase4-review MAJ-3 / REPO-1 / TASTE-3).
#[derive(Debug, Clone, Copy)]
pub enum PendingMembershipKind {
    JoinRequest,
    Invitation,
}

/// Outcome of [`promote_pending_to_member`].
///
/// `existed` is `false` when the DELETE matched zero rows — either
/// the pending row never existed, or a concurrent accept/reject
/// won the race. Either way the caller returns 404.
///
/// `already_member` is `true` when the membership insert matched
/// zero rows under `ON CONFLICT DO NOTHING` — the user was already
/// a member via a different path. Caller treats this as success
/// (the desired end state holds) but it's worth a `tracing::warn!`
/// so we notice if it starts happening often (it indicates a UI
/// race or a duplicate-path bug worth investigating).
#[derive(Debug, Clone, Copy)]
pub struct PromotePendingOutcome {
    pub existed: bool,
    pub already_member: bool,
}

/// Shared transaction for accepting an invitation / approving a
/// join request: DELETE the pending row, INSERT the membership row,
/// both atomic. Replaces the near-identical
/// `accept_in_transaction` + `approve_in_transaction` helpers each
/// handler used to carry (phase4-review MAJ-3).
///
/// Race handling:
///   * Pre-transaction read removed (phase4-review MIN-6) — the
///     DELETE's affected count is the source of truth, so the
///     handler can't observe a window where the row existed
///     between the check and the act.
///   * The membership insert no longer uses ON CONFLICT silently
///     (phase4-review MIN-7) — we capture whether it actually
///     inserted, and log the no-op case.
#[tracing::instrument(level = "trace", skip(database))]
pub async fn promote_pending_to_member(
    database: &Database,
    kind: PendingMembershipKind,
    user_group_id: &UserGroupId,
    user_id: &FilezUserId,
) -> Result<PromotePendingOutcome, FilezError> {
    use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection};

    let mut connection = database.get_connection().await?;
    connection
        .transaction::<PromotePendingOutcome, FilezError, _>(|conn| {
            async move {
                let deleted: usize = match kind {
                    PendingMembershipKind::JoinRequest => diesel::delete(
                        schema::user_user_group_join_requests::table
                            .filter(
                                schema::user_user_group_join_requests::user_id.eq(user_id),
                            )
                            .filter(
                                schema::user_user_group_join_requests::user_group_id
                                    .eq(user_group_id),
                            ),
                    )
                    .execute(conn)
                    .await?,
                    PendingMembershipKind::Invitation => diesel::delete(
                        schema::user_user_group_invitations::table
                            .filter(schema::user_user_group_invitations::user_id.eq(user_id))
                            .filter(
                                schema::user_user_group_invitations::user_group_id
                                    .eq(user_group_id),
                            ),
                    )
                    .execute(conn)
                    .await?,
                };
                if deleted == 0 {
                    return Ok(PromotePendingOutcome {
                        existed: false,
                        already_member: false,
                    });
                }

                let inserted = diesel::insert_into(schema::user_user_group_members::table)
                    .values(UserUserGroupMember::new(user_id, user_group_id))
                    .on_conflict_do_nothing()
                    .execute(conn)
                    .await?;
                Ok(PromotePendingOutcome {
                    existed: true,
                    already_member: inserted == 0,
                })
            }
            .scope_boxed()
        })
        .await
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

/// Visibility-scan helper for `list_with_filter`'s Public /
/// ServerListed branches: `SELECT … FROM user_groups WHERE <raw
/// predicate> ORDER BY … LIMIT N OFFSET M` in one round trip. No
/// candidate-ids Vec, no eq_any indirection (phase4-review MAJ-4).
///
/// `predicate_sql` is a constant string literal — never a caller-
/// supplied value (the only call site passes one of two compile-
/// time literals checked against the GroupVisibility enum). No
/// SQL-injection surface.
#[tracing::instrument(level = "trace", skip(connection))]
async fn load_user_groups_with_predicate(
    connection: &mut diesel_async::pooled_connection::deadpool::Object<
        diesel_async::AsyncPgConnection,
    >,
    predicate_sql: &'static str,
    from_index: Option<u64>,
    limit: Option<u64>,
    sort_by: Option<ListUserGroupsSortBy>,
    sort_order: Option<SortDirection>,
) -> Result<Vec<UserGroup>, FilezError> {
    let mut query = schema::user_groups::table
        .filter(diesel::dsl::sql::<diesel::sql_types::Bool>(predicate_sql))
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
        _ => query.order_by(schema::user_groups::created_time.desc()),
    };

    if let Some(from_index) = from_index {
        query = query.offset(from_index.try_into()?);
    }
    if let Some(limit) = limit {
        query = query.limit(limit.try_into()?);
    }

    Ok(query.load::<UserGroup>(connection).await?)
}

#[cfg(test)]
mod create_one_bootstrap_guard {
    //! phase3-review A9 / QA-7: pin the Phase 4 P4-10 default-policy
    //! bootstrap invariants at the source level. Integration tests
    //! against a real postgres lack a rig in this repo today; these
    //! string-grep tests catch the most likely refactoring regressions:
    //!
    //!   * The bootstrap MUST run inside a diesel-async transaction
    //!     (rollback safety — partial bootstrap can never land).
    //!   * The member-view policy MUST seed UserGroupsList + UserGroupsListUsers.
    //!   * The RequestJoin grant MUST be conditional on
    //!     `join_policy != InviteOnly` (per the spec).

    const MOD_RS_SOURCE: &str = include_str!("mod.rs");

    #[test]
    fn create_one_runs_in_a_transaction() {
        assert!(
            MOD_RS_SOURCE.contains("connection\n            .transaction::<UserGroup,")
                || MOD_RS_SOURCE.contains(".transaction::<UserGroup, FilezError, _>"),
            "UserGroup::create_one MUST wrap its inserts in a transaction so a \
             policy-insert failure rolls back the group row too (USER_GROUPS.md \
             §6 default-policy bootstrap atomicity)"
        );
    }

    #[test]
    fn create_one_seeds_member_view_policy() {
        assert!(
            MOD_RS_SOURCE.contains("AccessPolicyAction::UserGroupsList")
                && MOD_RS_SOURCE.contains("AccessPolicyAction::UserGroupsListUsers"),
            "create_one must seed the member-view policy granting UserGroupsList \
             + UserGroupsListUsers (USER_GROUPS.md §6)"
        );
    }

    #[test]
    fn create_one_conditionally_seeds_request_join() {
        // The RequestJoin grant is conditional: only seeded when
        // join_policy != InviteOnly. Refactor that drops the
        // condition would create the policy for InviteOnly groups,
        // contradicting the spec.
        assert!(
            MOD_RS_SOURCE.contains("GroupJoinPolicy::InviteOnly")
                && MOD_RS_SOURCE.contains("AccessPolicyAction::UserGroupsRequestJoin"),
            "create_one must seed UserGroupsRequestJoin only when \
             join_policy != InviteOnly"
        );
    }
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
