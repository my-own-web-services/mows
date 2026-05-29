//! Async Postgres pool + embedded migrations for the chat service.
//!
//! Mirrors `filez-server`'s `database/mod.rs` so a future
//! `mows-service-core` extraction can subsume both.

use std::fmt::Debug;

use anyhow::Context;
use diesel_async::{
    async_connection_wrapper::AsyncConnectionWrapper,
    pooled_connection::{
        deadpool::{Object, Pool},
        AsyncDieselConnectionManager,
    },
    AsyncConnection, AsyncPgConnection,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use mows_common_rust::get_current_config_cloned;

use crate::{config::config, errors::ChatError};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

pub type DatabaseConnection = Object<AsyncPgConnection>;

#[derive(Clone)]
pub struct Database {
    pub pool: Option<Pool<AsyncPgConnection>>,
}

impl Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database")
            .field("pool_initialized", &self.pool.is_some())
            .finish()
    }
}

impl Database {
    pub async fn new(db_url: &str) -> Self {
        let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(db_url);
        let pool = match Pool::builder(manager).build() {
            Ok(p) => Some(p),
            Err(e) => {
                tracing::error!("failed to build database connection pool: {e}");
                None
            }
        };
        Self { pool }
    }

    pub async fn get_connection(&self) -> Result<DatabaseConnection, ChatError> {
        match &self.pool {
            Some(pool) => pool.get().await.map_err(ChatError::from),
            None => Err(ChatError::DatabasePoolNotInitialized),
        }
    }

    /// Apply every pending migration on the configured database.
    /// Called once at boot. Spawns to `spawn_blocking` because
    /// `MigrationHarness::run_pending_migrations` is sync.
    pub async fn run_migrations() -> Result<(), ChatError> {
        let config = get_current_config_cloned!(config());
        let async_connection = AsyncPgConnection::establish(&config.db_url)
            .await
            .context("failed to establish async Postgres connection for migrations")?;
        let mut wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
            AsyncConnectionWrapper::from(async_connection);

        tokio::task::spawn_blocking(move || {
            wrapper
                .run_pending_migrations(MIGRATIONS)
                .map(|_versions| ())
                .map_err(|e| anyhow::anyhow!("migration runner reported failure: {e}"))
        })
        .await
        .context("migrations task panicked")?
        .context("failed to run pending migrations")?;
        Ok(())
    }
}
