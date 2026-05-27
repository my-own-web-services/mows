use crate::{
    models::{cover_tables, jobs::FilezJob},
    state::ServerState,
};
use tracing::{error, info, warn};

/// Retry interval in seconds for introspector reachability probe when it fails.
const INTROSPECTOR_PROBE_RETRY_SECONDS: u64 = 5;

const JOB_TIMEOUT_SECONDS: u64 = 60 * 60;

/// Listing-cover-table reconciler tick. Triggers maintain the cover
/// tables on every access_policies write; this sweep self-heals any
/// drift left by bulk-loader paths or future trigger bugs (Phase 5
/// P5-2). One hour is the trade-off: trigger drift should be rare,
/// so frequent sweeps waste cycles; but a missed drift that goes
/// undetected for a day silently corrupts listing results until the
/// reconciler runs. Hourly catches drift within one billing window
/// even at the USER_GROUPS.md §1 scale target (the sweep is
/// O(distinct subject × resource pairs)).
const COVER_RECONCILER_INTERVAL_SECONDS: u64 = 60 * 60;

/// Materialisation-threshold recompute tick (LISTING.md §6.2 /
/// Phase 5 P5-3). Daily because group sizes drift slowly — a
/// group rarely crosses the 1000-member threshold more than once
/// in a day, and getting the flip an hour late on day 1 vs day 2
/// of crossing makes no observable difference to listing
/// behaviour. Hourly would just burn cycles re-COUNTing 100k
/// groups for zero benefit.
const MATERIALIZE_FLAGS_INTERVAL_SECONDS: u64 = 24 * 60 * 60;

/// Cap on the exponential-backoff multiplier
/// (phase3-review A3 / SLOP-2). With base intervals of 1h / 24h,
/// 16× → 16h / 16 days respectively. Above that the task is
/// effectively offline; an operator should be paged via the
/// `consecutive_failures` structured field on the error log.
const MAX_BACKOFF_MULTIPLIER: u32 = 16;

/// Compute the next sleep duration for a background-task loop given
/// the base interval and the count of consecutive failures so far.
/// Multiplier grows 1 → 4 → 16 (capped); on success the caller
/// resets `consecutive_failures` to 0.
fn sleep_with_backoff(base_seconds: u64, consecutive_failures: u32) -> u64 {
    let multiplier = match consecutive_failures {
        0 => 1u32,
        1 => 4u32,
        _ => MAX_BACKOFF_MULTIPLIER,
    };
    base_seconds.saturating_mul(multiplier as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_returns_base_interval_on_success() {
        assert_eq!(sleep_with_backoff(60, 0), 60);
    }

    #[test]
    fn backoff_quadruples_on_first_failure() {
        assert_eq!(sleep_with_backoff(60, 1), 240);
    }

    #[test]
    fn backoff_caps_at_max_multiplier() {
        assert_eq!(sleep_with_backoff(60, 2), 60 * 16);
        assert_eq!(sleep_with_backoff(60, 100), 60 * 16);
        assert_eq!(sleep_with_backoff(60, u32::MAX), 60 * 16);
    }

    #[test]
    fn backoff_saturates_on_overflow() {
        // Saturating_mul keeps the schedule sane even on
        // pathological inputs (a base of u64::MAX shouldn't wrap).
        assert_eq!(sleep_with_backoff(u64::MAX, 2), u64::MAX);
    }
}

#[tracing::instrument(level = "trace", skip(server_state))]
pub fn run_background_tasks(server_state: &ServerState) {
    // Job release task
    let database = server_state.database.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = FilezJob::release_jobs(&database, JOB_TIMEOUT_SECONDS).await {
                error!("Error releasing jobs: {}", e);
            }
            tokio::time::sleep(std::time::Duration::from_secs(JOB_TIMEOUT_SECONDS)).await;
        }
    });

    // Listing-cover-table reconciler. Self-heals drift between
    // access_policies and the cover tables on a fixed interval;
    // emits one audit_log row per sweep so a sudden drop in
    // processed-row count surfaces in admin dashboards.
    //
    // Backoff: on consecutive failures, sleep grows 1× → 4× → 16×
    // (capped at MAX_BACKOFF_MULTIPLIER) so a broken DB isn't
    // thrashed once per interval. Resets to 1× on success
    // (phase3-review A3 / SLOP-2).
    let database = server_state.database.clone();
    tokio::spawn(async move {
        let mut consecutive_failures: u32 = 0;
        loop {
            let sleep_secs = sleep_with_backoff(
                COVER_RECONCILER_INTERVAL_SECONDS,
                consecutive_failures,
            );
            tokio::time::sleep(std::time::Duration::from_secs(sleep_secs)).await;
            match cover_tables::reconcile_listing_cover_tables(&database).await {
                Ok(n) => {
                    info!(rows_processed = n, "Cover-table reconciler tick complete");
                    consecutive_failures = 0;
                }
                Err(e) => {
                    consecutive_failures = consecutive_failures.saturating_add(1);
                    error!(
                        consecutive_failures,
                        "Cover-table reconciler failed: {e}"
                    );
                }
            }
        }
    });

    // Materialisation-threshold recompute. Counts members per
    // user-group + flips the `materialize_uga` flag for groups
    // that cross the threshold. Daily; emits one audit row per
    // sweep with the flip count (LISTING.md §6.2 / P5-3).
    //
    // Same exponential-backoff pattern as the cover reconciler
    // (phase3-review A3 / SLOP-2). info! demoted to debug! because
    // the durable audit_log row is the source of truth for "did
    // this run?" (phase3-review A10 / SLOP-9).
    let database = server_state.database.clone();
    tokio::spawn(async move {
        let mut consecutive_failures: u32 = 0;
        loop {
            let sleep_secs = sleep_with_backoff(
                MATERIALIZE_FLAGS_INTERVAL_SECONDS,
                consecutive_failures,
            );
            tokio::time::sleep(std::time::Duration::from_secs(sleep_secs)).await;
            match cover_tables::recompute_user_group_materialize_flags(&database).await {
                Ok(n) => {
                    tracing::debug!(
                        flags_flipped = n,
                        "user_groups materialize_uga recompute tick complete"
                    );
                    consecutive_failures = 0;
                }
                Err(e) => {
                    consecutive_failures = consecutive_failures.saturating_add(1);
                    error!(
                        consecutive_failures,
                        "materialize_uga recompute failed: {e}"
                    );
                }
            }
        }
    });

    // Introspector warm-up: probe until the IdP is reachable, then
    // exit. The first `introspect()` call would discover the URL
    // lazily anyway — this just makes the first authenticated request
    // fast instead of paying the discovery cost in the hot path. If
    // the IdP is unreachable at boot we keep retrying so the cluster
    // can come up before Zitadel.
    let introspector = server_state.introspector.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        loop {
            match introspector.health_check().await {
                Ok(()) => {
                    info!("Introspector reachable; warm-up complete");
                    break;
                }
                Err(e) => {
                    warn!(
                        "Introspector unreachable: {e}. Retrying in {INTROSPECTOR_PROBE_RETRY_SECONDS}s."
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(
                        INTROSPECTOR_PROBE_RETRY_SECONDS,
                    ))
                    .await;
                }
            }
        }
    });
}
