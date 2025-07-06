use crate::{config::FilezServerConfig, errors::FilezError};
use anyhow::Context;
use diesel_async::{
    async_connection_wrapper::AsyncConnectionWrapper, AsyncConnection, RunQueryDsl,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

#[derive(Clone)]
pub struct Db {
    pub pool: Pool<diesel_async::AsyncPgConnection>,
}

impl Db {
    pub async fn new(pool: Pool<diesel_async::AsyncPgConnection>) -> Self {
        Self { pool }
    }

    pub async fn run_migrations(config: &FilezServerConfig) -> Result<(), FilezError> {
        match AsyncPgConnection::establish(&config.db_url)
            .await
            .context("Failed to establish async Postgres connection")
        {
            Ok(async_connection) => {
                let mut async_wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
                    AsyncConnectionWrapper::from(async_connection);

                tokio::task::spawn_blocking(move || {
                    async_wrapper.run_pending_migrations(MIGRATIONS).unwrap();
                })
                .await
                .context("Failed to run pending migrations")?;
            }
            Err(e) => {
                tracing::error!("Failed to establish async Postgres connection: {e}");
            }
        };
        Ok(())
    }

    pub async fn get_health(&self) -> Result<(), FilezError> {
        let mut conn = self.pool.get().await?;
        diesel::select(diesel::dsl::sql::<diesel::sql_types::Bool>("1 = 1"))
            .get_result::<bool>(&mut conn)
            .await?;
        Ok(())
    }
}
