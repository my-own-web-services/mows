//! Apply the embedded migrations to an arbitrary `DATABASE_URL`.
//!
//! The dev / test SQL workflow needs an idempotent way to bring a
//! fresh dev DB up to current schema WITHOUT shelling to
//! `diesel migration run` (which regenerates `schema.rs` from the
//! live DB via diesel.toml's `[print_schema]` — `schema.rs` is
//! hand-curated; auto-regen breaks the lib build).
//!
//! Usage:
//!     DATABASE_URL=postgres://… cargo run --bin run_migrations
//!
//! Reads the same `MIGRATIONS` constant the server binary uses on
//! boot, so the schema this writes is exactly the schema the
//! server will see.

use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
use diesel_async::{AsyncConnection, AsyncPgConnection};
use diesel_migrations::MigrationHarness;
use filez_server_lib::database::MIGRATIONS;
use std::env;
use std::process::ExitCode;

#[tokio::main]
async fn main() -> ExitCode {
    let db_url = match env::var("DATABASE_URL") {
        Ok(v) => v,
        Err(_) => {
            eprintln!("DATABASE_URL not set");
            return ExitCode::from(2);
        }
    };

    let async_connection = match AsyncPgConnection::establish(&db_url).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("failed to connect to {db_url}: {e}");
            return ExitCode::from(3);
        }
    };
    let mut wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
        AsyncConnectionWrapper::from(async_connection);

    let result = tokio::task::spawn_blocking(move || {
        wrapper
            .run_pending_migrations(MIGRATIONS)
            .map(|versions| versions.len())
    })
    .await;

    match result {
        Ok(Ok(n)) => {
            println!("applied {n} pending migration(s)");
            ExitCode::SUCCESS
        }
        Ok(Err(e)) => {
            eprintln!("migration runner reported failure: {e}");
            ExitCode::from(1)
        }
        Err(e) => {
            eprintln!("migration task panicked: {e}");
            ExitCode::from(1)
        }
    }
}
