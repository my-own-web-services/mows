use crate::config::config;
use crate::models::apps::MowsApp;
use crate::{ errors::FilezError};
use anyhow::Context;
use diesel::sql_query;
use diesel_async::pooled_connection::deadpool::Object;
use diesel_async::pooled_connection::AsyncDieselConnectionManager;
use diesel_async::{
    async_connection_wrapper::AsyncConnectionWrapper, AsyncConnection, RunQueryDsl,
};
use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use mows_common_rust::get_current_config_cloned;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

#[derive(Clone)]
pub struct Database {
    pub pool: Option<Pool<diesel_async::AsyncPgConnection>>,
}

pub type DatabaseConnection = Object<AsyncPgConnection>;

impl Database {
    pub async fn new(db_url: &str) -> Self {
        let connection_manager =
            AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(db_url);

        let pool = match Pool::builder(connection_manager).build() {
            Ok(pool) => Some(pool),
            Err(e) => {
                tracing::error!("Failed to create database connection pool: {}", e);
                None
            }
        };
        Self { pool }
    }

    pub async fn get_connection(&self) -> Result<DatabaseConnection, FilezError> {
        match &self.pool {
            Some(pool) => pool.get().await.map_err(FilezError::from),
            None => Err(FilezError::DatabasePoolNotInitialized),
        }
    }

    pub async fn dev_full_reset(&self) -> Result<(), FilezError> {
        let config = get_current_config_cloned!(config());
        if config.enable_dev {
            let mut connection = self.get_connection().await?;

            sql_query("DROP SCHEMA public CASCADE;")
                .execute(&mut connection)
                .await?;

            sql_query("CREATE SCHEMA public;")
                .execute(&mut connection)
                .await?;

            Self::run_migrations().await?;
        }
        Ok(())
    }

    pub async fn run_migrations() -> Result<(), FilezError> {
        let config = get_current_config_cloned!(config());
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
