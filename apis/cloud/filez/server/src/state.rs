use crate::{
    config::FilezServerConfig,
    controller::{ControllerContext, ControllerState, Diagnostics},
    db::Db,
    errors::FilezError,
    models::storage_locations::StorageLocation,
    storage::providers::StorageProvider,
};
use anyhow::Context;
use axum::extract::FromRef;
use diesel_async::pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager};
use kube::Client;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;
use zitadel::{
    axum::introspection::{IntrospectionState, IntrospectionStateBuilder},
    oidc::introspection::cache::in_memory::InMemoryIntrospectionCache,
};

#[derive(Clone)]
pub struct ServerState {
    pub db: Db,
    pub introspection_state: zitadel::axum::introspection::IntrospectionState,
    pub controller_state: ControllerState,
    pub storage_location_providers: StorageLocationState,
}

pub type StorageLocationState = Arc<RwLock<HashMap<Uuid, StorageProvider>>>;

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

        let connection_manager =
            AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(
                config.db_url.clone(),
            );

        let pool = Pool::builder(connection_manager)
            .build()
            .context("Failed to create Postgres connection pool")?;

        let db = Db::new(pool).await;

        match db.create_filez_server_app().await {
            Ok(_) => tracing::info!("Filez server app created successfully"),
            Err(e) => tracing::warn!("Failed to create Filez server app: {}", e),
        }

        let storage_location_providers = StorageLocation::initialize_all_providers(&db).await?;

        Ok(Self {
            db,
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
            db: self.db.clone(),
            storage_location_providers: self.storage_location_providers.clone(),
        })
    }
}
