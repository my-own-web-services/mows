//! Listing cover tables — reconciler entry point.
//!
//! The cover tables themselves
//! (`public_resources` / `server_member_resources` /
//! `user_group_accessible_resources`) are queried inline by the
//! Phase-3 listing engine when it lands; until then they sit
//! quietly behind the trigger-maintained schema (migration
//! 00000000000007_listing_cover_tables) and are validated for drift
//! by this reconciler (Phase 5 P5-2).
//!
//! The reconciler calls a PL/pgSQL function shipped in migration
//! 00000000000015_listing_cover_reconciler that re-derives every
//! cover row from `access_policies` via the same
//! `refresh_listing_cover_row` function the triggers use. Cost is
//! O(distinct subject × resource pairs); fine to run hourly at the
//! USER_GROUPS.md §1 scale target.

use diesel::{sql_types::Integer, QueryableByName};
use diesel_async::RunQueryDsl;

use crate::{
    database::Database,
    errors::FilezError,
    models::{
        access_policies::AccessPolicyResourceType,
        audit_log::{AuditEvent, AuditLog},
        user_groups::UserGroupId,
        users::FilezUserId,
    },
};
use diesel::sql_types::Uuid as SqlUuid;

#[derive(QueryableByName, Debug)]
struct ReconcileRow {
    #[diesel(sql_type = Integer)]
    reconcile_listing_cover_tables: i32,
}

/// Re-derive every listing cover row from the current
/// `access_policies` state, self-healing any drift left by bulk-
/// loader paths or trigger bugs. Returns the number of (subject,
/// resource) pairs processed. Emits one `audit_log` row with
/// `event_type = "cover_tables_reconciled"` so an admin can
/// chart the cadence + spot anomalies.
///
/// `actor_id = None` because the reconciler is system-initiated
/// (cron / background task). The audit row's
/// `resource_type = User` is conventional for "system-level
/// maintenance event"; future variants may grow a dedicated
/// `ResourceType::System` sentinel.
#[tracing::instrument(level = "trace", skip(database))]
pub async fn reconcile_listing_cover_tables(
    database: &Database,
) -> Result<usize, FilezError> {
    let mut connection = database.get_connection().await?;
    let result: ReconcileRow =
        diesel::sql_query("SELECT reconcile_listing_cover_tables()")
            .get_result(&mut connection)
            .await?;
    let rows_processed = usize::try_from(result.reconcile_listing_cover_tables)
        .map_err(FilezError::TryFromIntError)?;

    AuditLog::insert(
        database,
        AuditEvent::CoverTablesReconciled { rows_processed },
        None,
        AccessPolicyResourceType::User,
        None,
    )
    .await?;

    Ok(rows_processed)
}

/// LISTING.md §6.2 / Phase 5 P5-3: walk every `user_groups` row,
/// count its members, flip `materialize_uga` when it crosses the
/// threshold defined by `user_group_materialize_threshold()` (1000
/// today). Returns the count of groups whose flag actually changed
/// in this sweep — emitted as an audit row so a sudden spike
/// surfaces in admin dashboards.
///
/// The flag is the metadata the Phase-3 listing engine reads to
/// pick between cover-table and live-join paths for UserGroup-
/// subjected listings. Today it's pure metadata; the read-path
/// consumer ships with Phase 3.
#[tracing::instrument(level = "trace", skip(database))]
pub async fn recompute_user_group_materialize_flags(
    database: &Database,
) -> Result<usize, FilezError> {
    #[derive(QueryableByName, Debug)]
    struct RecomputeRow {
        #[diesel(sql_type = Integer)]
        recompute_user_group_materialize_flags: i32,
    }

    let mut connection = database.get_connection().await?;
    let result: RecomputeRow =
        diesel::sql_query("SELECT recompute_user_group_materialize_flags()")
            .get_result(&mut connection)
            .await?;
    let flags_flipped =
        usize::try_from(result.recompute_user_group_materialize_flags)
            .map_err(FilezError::TryFromIntError)?;

    AuditLog::insert(
        database,
        AuditEvent::UserGroupMaterializeFlagsRecomputed { flags_flipped },
        None,
        AccessPolicyResourceType::UserGroup,
        None,
    )
    .await?;

    Ok(flags_flipped)
}

/// Phase 5 P5-4 — targeted bulk-rebuild of ONE user-group's cover
/// rows. Drains live `DirectPolicy` reads for the group and
/// re-derives every entry in `user_group_accessible_resources`
/// from the current `access_policies` state. Returns the count of
/// (group, resource) pairs processed.
///
/// Use cases:
///   - the daily materialise-flag flip promoted this group from
///     small to large (LISTING.md §6.2); the cover needs a backfill
///     before the Phase-3 read path can switch over.
///   - an operator observed drift on one group and wants a
///     targeted rebuild without paying the full reconciler's
///     O(distinct subject × resource) cost across the whole table.
///
/// `actor_id` is `Some(...)` when an operator triggered the
/// rebuild, `None` when the daily threshold-flip job did. The
/// audit row's `resource_id` points at the affected group.
#[tracing::instrument(level = "trace", skip(database))]
pub async fn rebuild_user_group_cover(
    database: &Database,
    user_group_id: &UserGroupId,
    actor_id: Option<&FilezUserId>,
) -> Result<usize, FilezError> {
    #[derive(QueryableByName, Debug)]
    struct RebuildRow {
        #[diesel(sql_type = Integer)]
        rebuild_user_group_cover: i32,
    }

    let mut connection = database.get_connection().await?;
    let result: RebuildRow = diesel::sql_query("SELECT rebuild_user_group_cover($1)")
        .bind::<SqlUuid, _>(user_group_id.0)
        .get_result(&mut connection)
        .await?;
    let rows_processed = usize::try_from(result.rebuild_user_group_cover)
        .map_err(FilezError::TryFromIntError)?;

    AuditLog::insert(
        database,
        AuditEvent::UserGroupCoverRebuilt { rows_processed },
        actor_id,
        AccessPolicyResourceType::UserGroup,
        Some(user_group_id.0),
    )
    .await?;

    Ok(rows_processed)
}

/// Phase 5 P5-4 — targeted bulk-rebuild of the whole
/// `public_resources` cover. Operator-only entry point; the daily
/// reconciler already covers this surface as part of its sweep.
/// Useful when an operator suspects drift on this cover and wants
/// to fix it without waiting an hour.
#[tracing::instrument(level = "trace", skip(database))]
pub async fn rebuild_public_cover(
    database: &Database,
    actor_id: Option<&FilezUserId>,
) -> Result<usize, FilezError> {
    #[derive(QueryableByName, Debug)]
    struct RebuildRow {
        #[diesel(sql_type = Integer)]
        rebuild_public_cover: i32,
    }

    let mut connection = database.get_connection().await?;
    let result: RebuildRow = diesel::sql_query("SELECT rebuild_public_cover()")
        .get_result(&mut connection)
        .await?;
    let rows_processed = usize::try_from(result.rebuild_public_cover)
        .map_err(FilezError::TryFromIntError)?;

    AuditLog::insert(
        database,
        AuditEvent::PublicCoverRebuilt { rows_processed },
        actor_id,
        AccessPolicyResourceType::User,
        None,
    )
    .await?;

    Ok(rows_processed)
}

/// Phase 5 P5-4 — targeted bulk-rebuild of the whole
/// `server_member_resources` cover. Operator-only entry point;
/// mirrors [`rebuild_public_cover`] for the ServerMember surface.
#[tracing::instrument(level = "trace", skip(database))]
pub async fn rebuild_server_member_cover(
    database: &Database,
    actor_id: Option<&FilezUserId>,
) -> Result<usize, FilezError> {
    #[derive(QueryableByName, Debug)]
    struct RebuildRow {
        #[diesel(sql_type = Integer)]
        rebuild_server_member_cover: i32,
    }

    let mut connection = database.get_connection().await?;
    let result: RebuildRow = diesel::sql_query("SELECT rebuild_server_member_cover()")
        .get_result(&mut connection)
        .await?;
    let rows_processed = usize::try_from(result.rebuild_server_member_cover)
        .map_err(FilezError::TryFromIntError)?;

    AuditLog::insert(
        database,
        AuditEvent::ServerMemberCoverRebuilt { rows_processed },
        actor_id,
        AccessPolicyResourceType::User,
        None,
    )
    .await?;

    Ok(rows_processed)
}
