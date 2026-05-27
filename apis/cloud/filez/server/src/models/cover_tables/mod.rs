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
    },
};

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
