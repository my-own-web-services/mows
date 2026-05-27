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
    let database = server_state.database.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(
                COVER_RECONCILER_INTERVAL_SECONDS,
            ))
            .await;
            match cover_tables::reconcile_listing_cover_tables(&database).await {
                Ok(n) => info!(rows_processed = n, "Cover-table reconciler tick complete"),
                Err(e) => error!("Cover-table reconciler failed: {e}"),
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
