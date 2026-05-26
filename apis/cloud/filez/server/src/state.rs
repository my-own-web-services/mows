use crate::{
    config::FilezServerConfig,
    database::Database,
    errors::FilezError,
    kubernetes_controller::{ControllerContext, ControllerState, Diagnostics},
    models::storage_locations::{StorageLocation, StorageLocationId},
    storage::providers::StorageProvider,
};
use kube::Client;
use mows_auth_core::{TokenIntrospector, ZitadelIntrospector, ZITADEL_IDP_ID};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

use zitadel::oidc::introspection::{
    cache::in_memory::InMemoryIntrospectionCache, AuthorityAuthentication,
};

#[derive(Clone, Debug)]
pub struct ServerState {
    pub database: Database,
    /// IdP-agnostic introspection — v1 is `ZitadelIntrospector` under
    /// the hood, but the middleware never names the concrete type.
    /// Swapping to a different IdP later is a single-line change in
    /// `ServerState::new`.
    pub introspector: Arc<dyn TokenIntrospector>,
    pub controller_state: ControllerState,
    pub storage_location_providers: StorageLocationState,
}

pub type StorageLocationState = Arc<RwLock<HashMap<StorageLocationId, StorageProvider>>>;

impl ServerState {
    #[tracing::instrument(level = "trace")]
    pub async fn new(config: &FilezServerConfig) -> Result<Self, FilezError> {
        let introspector: Arc<dyn TokenIntrospector> = Arc::new(ZitadelIntrospector::new(
            ZITADEL_IDP_ID,
            config.oidc_issuer.clone(),
            AuthorityAuthentication::Basic {
                client_id: config.oidc_client_id.clone(),
                client_secret: config.oidc_client_secret.clone(),
            },
            Some(Box::new(InMemoryIntrospectionCache::new())),
        ));

        let database = Database::new(&config.db_url).await;

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
            introspector,
            controller_state: ControllerState::default(),
            storage_location_providers,
        })
    }

    pub fn metrics(&self) -> String {
        let mut buffer = String::new();
        let registry = &*self.controller_state.metrics.registry;
        // `text::encode` returns `Result<(), fmt::Error>`, which can only
        // fail if the `Write` impl errors. Writing to `String` is
        // infallible — log + return an empty payload rather than panic
        // the metrics endpoint (which would take down the scraper).
        if let Err(err) = prometheus_client::encoding::text::encode(&mut buffer, registry) {
            tracing::error!(error = %err, "failed to encode prometheus metrics");
            return String::new();
        }
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
