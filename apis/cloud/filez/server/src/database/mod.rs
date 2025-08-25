use crate::models::apps::MowsApp;
use crate::{config::FilezServerConfig, errors::FilezError};
use anyhow::Context;
use diesel::sql_query;
use diesel_async::pooled_connection::deadpool::Object;
use diesel_async::{
    async_connection_wrapper::AsyncConnectionWrapper, AsyncConnection, RunQueryDsl,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

#[derive(Clone)]
pub struct Database {
    pub pool: Option<Pool<diesel_async::AsyncPgConnection>>,
}

pub type DatabaseConnection = Object<AsyncPgConnection>;

impl Database {
    pub async fn new(pool: Option<Pool<diesel_async::AsyncPgConnection>>) -> Self {
        Self { pool }
    }

    pub async fn get_connection(&self) -> Result<DatabaseConnection, FilezError> {
        match &self.pool {
            Some(pool) => pool.get().await.map_err(FilezError::from),
            None => Err(FilezError::DatabasePoolNotInitialized),
        }
    }

    pub async fn drop_if_dev_mode(config: &FilezServerConfig) -> Result<(), FilezError> {
        if config.enable_dev {
            match AsyncPgConnection::establish(&config.db_url)
                .await
                .context("Failed to establish async Postgres connection")
            {
                Ok(mut async_connection) => {
                    // Drop the 'public' schema to remove all tables, and then recreate it.
                    // CASCADE ensures that all dependent objects are also dropped.
                    let drop_and_recreate_schema_query =
                        "DROP SCHEMA public CASCADE; CREATE SCHEMA public;";

                    if let Err(e) = sql_query(drop_and_recreate_schema_query)
                        .execute(&mut async_connection)
                        .await
                    {
                        tracing::error!("Failed to drop and recreate public schema: {}", e);
                    } else {
                        tracing::info!("Successfully dropped and recreated the public schema.");
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to establish async Postgres connection: {e}");
                }
            };
        }
        Ok(())
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

    pub async fn create_filez_server_app(&self) -> Result<MowsApp, FilezError> {
        MowsApp::create_filez_server_app(&self).await
    }

    pub async fn get_health(&self) -> Result<(), FilezError> {
        let mut connection = self.get_connection().await?;
        diesel::select(diesel::dsl::sql::<diesel::sql_types::Bool>("1 = 1"))
            .get_result::<bool>(&mut connection)
            .await?;
        Ok(())
    }
}
