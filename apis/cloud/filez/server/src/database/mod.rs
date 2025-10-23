use std::fmt::Debug;

use crate::config::config;
use crate::errors::FilezError;
use crate::models::apps::MowsApp;
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
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

#[derive(Clone)]
pub struct Database {
    pub pool: Option<Pool<diesel_async::AsyncPgConnection>>,
}

impl Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database")
            .field("pool_initialized", &self.pool.is_some())
            .finish()
    }
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

    pub async fn get_health(&self) -> Result<DatabaseHealthDetails, FilezError> {
        let mut details = DatabaseHealthDetails {
            reachable: false,
            latency_ms: None,
            pool_status: None,
            version: None,
            connection_count: None,
            max_connections: None,
            database_size: None,
            error: None,
        };

        // Check if pool is initialized
        let pool = match &self.pool {
            Some(p) => p,
            None => {
                details.error = Some("Database pool not initialized".to_string());
                return Ok(details);
            }
        };

        // Get pool status
        let pool_state = pool.status();
        details.pool_status = Some(PoolStatus {
            size: pool_state.size,
            available: pool_state.available,
            max_size: pool_state.max_size,
        });

        // Measure latency and check reachability
        let start = std::time::Instant::now();
        let mut connection = match self.get_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                details.error = Some(format!("Failed to get connection: {}", e));
                return Ok(details);
            }
        };

        // Simple ping query
        match diesel::select(diesel::dsl::sql::<diesel::sql_types::Bool>("1 = 1"))
            .get_result::<bool>(&mut connection)
            .await
        {
            Ok(_) => {
                details.reachable = true;
                details.latency_ms = Some(start.elapsed().as_millis() as u64);
            }
            Err(e) => {
                details.error = Some(format!("Health check query failed: {}", e));
                return Ok(details);
            }
        }

        // Get PostgreSQL version
        if let Ok(version) =
            diesel::select(diesel::dsl::sql::<diesel::sql_types::Text>("version()"))
                .get_result::<String>(&mut connection)
                .await
        {
            details.version = Some(version);
        }

        // Get current connection count
        if let Ok(count) = sql_query(
            "SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()",
        )
        .get_result::<ConnectionCount>(&mut connection)
        .await
        {
            details.connection_count = Some(count.count);
        }

        // Get max connections setting
        if let Ok(max_conn) = sql_query("SHOW max_connections")
            .get_result::<MaxConnections>(&mut connection)
            .await
        {
            details.max_connections = max_conn.max_connections.parse::<i32>().ok();
        }

        // Get database size
        if let Ok(size) = sql_query("SELECT pg_database_size(current_database()) as size")
            .get_result::<DatabaseSize>(&mut connection)
            .await
        {
            details.database_size = Some(size.size);
        }

        Ok(details)
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct DatabaseHealthDetails {
    pub reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_status: Option<PoolStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_connections: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct PoolStatus {
    pub size: usize,
    pub available: usize,
    pub max_size: usize,
}

#[derive(diesel::QueryableByName)]
struct ConnectionCount {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

#[derive(diesel::QueryableByName)]
struct MaxConnections {
    #[diesel(sql_type = diesel::sql_types::Text)]
    max_connections: String,
}

#[derive(diesel::QueryableByName)]
struct DatabaseSize {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    size: i64,
}
