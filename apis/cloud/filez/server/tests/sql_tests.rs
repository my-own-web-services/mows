//! Rust wrapper that runs the SQL tests under `tests/sql/` against
//! the dev DB. Skipped (without failing) when the dev DB isn't
//! reachable so `cargo test` stays green in environments without a
//! Postgres instance — to opt in:
//!
//!     bash scripts/start-dev-db.sh
//!     cargo test --test sql_tests
//!
//! The wrapper shells out to `scripts/run-sql-tests.sh` so the same
//! script is reachable both standalone (for fast iteration) and
//! from the Rust test harness.
//!
//! Phase 5 P5-5: covers the LISTING.md §16 "Cover consistency"
//! obligation by running the random-walk SQL test that asserts
//! trigger-maintained cover state matches a recomputed-from-scratch
//! reference. Also runs the P5-4 bulk-rebuild consistency check.

use std::env;
use std::process::Command;

const DEFAULT_DB_URL: &str = "postgres://filez:filez@127.0.0.1:5432/filez";

#[test]
fn sql_test_suite() {
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DB_URL.to_string());

    // Probe the DB once. If it isn't up, print a clear skip line
    // (NOT a fail — the suite is opt-in for environments with the
    // dev DB running) and return.
    let probe = Command::new("psql")
        .args(["-d", &db_url, "-c", "SELECT 1"])
        .output();
    let reachable = matches!(probe, Ok(o) if o.status.success());
    if !reachable {
        eprintln!(
            "SKIP sql_test_suite: cannot reach DATABASE_URL={db_url} \
             — bring up the dev DB with `bash scripts/start-dev-db.sh` to run",
        );
        return;
    }

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let status = Command::new("bash")
        .arg(format!("{manifest_dir}/scripts/run-sql-tests.sh"))
        .env("DATABASE_URL", &db_url)
        .status()
        .expect("failed to invoke run-sql-tests.sh");

    assert!(
        status.success(),
        "SQL test suite reported failure (exit {})",
        status.code().unwrap_or(-1),
    );
}
