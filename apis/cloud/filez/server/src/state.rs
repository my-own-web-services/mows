use crate::{
    config::FilezServerConfig,
    controller::{ControllerContext, ControllerState, Diagnostics},
    database::Database,
    errors::FilezError,
    http_api::authentication::{
        state::IntrospectionState, state_builder::IntrospectionStateBuilder,
    },
    models::storage_locations::{StorageLocation, StorageLocationId},
    storage::providers::StorageProvider,
};
use anyhow::Context;
use diesel_async::pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager};
use kube::Client;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

use zitadel::oidc::introspection::cache::in_memory::InMemoryIntrospectionCache;

#[derive(Clone)]
pub struct ServerState {
    pub database: Database,
    pub introspection_state: IntrospectionState,
    pub controller_state: ControllerState,
    pub storage_location_providers: StorageLocationState,
}

pub type StorageLocationState = Arc<RwLock<HashMap<StorageLocationId, StorageProvider>>>;

impl ServerState {
    pub async fn new(config: &FilezServerConfig) -> Result<Self, FilezError> {
        let introspection_state = IntrospectionStateBuilder::new(&config.oidc_issuer.clone())
            .with_basic_auth(
                &config.oidc_client_id.clone(),
                &config.oidc_client_secret.clone(),
            )
            .with_introspection_cache(InMemoryIntrospectionCache::new())
            .build()
            .await
            .context("Failed to create introspection state")?;

        let connection_manager =
            AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(
                config.db_url.clone(),
            );

        let pool = match Pool::builder(connection_manager).build() {
            Ok(pool) => Some(pool),
            Err(e) => {
                tracing::error!("Failed to create database connection pool: {}", e);
                None
            }
        };

        let database = Database::new(pool).await;

        match database.create_filez_server_app().await {
            Ok(_) => tracing::info!("Filez server app created successfully"),
            Err(e) => tracing::warn!("Failed to create Filez server app: {}", e),
        }

        let storage_location_providers =
            match StorageLocation::initialize_all_providers(&database).await {
                Ok(providers) => providers,
                Err(e) => {
                    tracing::error!("Failed to initialize storage location providers: {}", e);
                    Arc::new(RwLock::new(HashMap::new()))
                }
            };

        Ok(Self {
            database,
            introspection_state,
            controller_state: ControllerState::default(),
            storage_location_providers,
        })
    }

    pub fn metrics(&self) -> String {
        let mut buffer = String::new();
        let registry = &*self.controller_state.metrics.registry;
        prometheus_client::encoding::text::encode(&mut buffer, registry).unwrap();
        buffer
    }

    /// State getter
    pub async fn diagnostics(&self) -> Diagnostics {
        self.controller_state.diagnostics.read().await.clone()
    }

    // Create a Controller Context that can update State
    pub fn to_context(&self, client: Client) -> Arc<ControllerContext> {
        Arc::new(ControllerContext {
            client,
            metrics: self.controller_state.metrics.clone(),
            diagnostics: self.controller_state.diagnostics.clone(),
            database: self.database.clone(),
            storage_location_providers: self.storage_location_providers.clone(),
        })
    }
}
