//! Apply the embedded chat-server migrations to an arbitrary
//! `DATABASE_URL`. Mirrors filez-server's `run_migrations` binary
//! so the local dev workflow + SQL test rig (Round 5) can bring a
//! fresh dev DB up without reaching for `diesel migration run`.

use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
use diesel_async::{AsyncConnection, AsyncPgConnection};
use diesel_migrations::MigrationHarness;
use std::env;
use std::process::ExitCode;

use chat_server_lib::database::MIGRATIONS;

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
