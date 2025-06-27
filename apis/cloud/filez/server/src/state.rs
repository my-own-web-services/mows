use std::{collections::HashMap, sync::Arc};

use anyhow::Context;
use axum::extract::FromRef;
use diesel_async::pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager};
use kube::Client;
use tokio::sync::RwLock;
use zitadel::{
    axum::introspection::{IntrospectionState, IntrospectionStateBuilder},
    oidc::introspection::cache::in_memory::InMemoryIntrospectionCache,
};

use crate::{
    apps::FilezApp,
    config::FilezServerConfig,
    controller::{ControllerContext, ControllerState, Diagnostics},
    db::Db,
    errors::FilezError,
    storage::state::StorageLocationsState,
};

#[derive(Clone)]
pub struct ServerState {
    pub db: Db,
    pub storage_locations: StorageLocationsState,
    pub introspection_state: zitadel::axum::introspection::IntrospectionState,
    pub controller_state: ControllerState,
    pub apps: Arc<RwLock<HashMap<String, FilezApp>>>,
}

impl FromRef<ServerState> for IntrospectionState {
    fn from_ref(app_state: &ServerState) -> IntrospectionState {
        app_state.introspection_state.clone()
    }
}

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

        // create the postgres connection pool
        let connection_manager =
            AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(
                config.db_url.clone(),
            );
        let pool = Pool::builder(connection_manager)
            .build()
            .context("Failed to create Postgres connection pool")?;
        let db = Db::new(pool).await;

        Ok(Self {
            db,
            storage_locations: StorageLocationsState::new(),
            introspection_state,
            controller_state: ControllerState::default(),
            apps: Arc::new(RwLock::new(HashMap::new())),
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
            apps: self.apps.clone(),
            storage_locations: self.storage_locations.clone(),
        })
    }
}
