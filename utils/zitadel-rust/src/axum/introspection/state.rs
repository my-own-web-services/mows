use openidconnect::IntrospectionUrl;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(feature = "introspection_cache")]
use crate::oidc::introspection::cache::IntrospectionCache;
use crate::oidc::{discovery::discover, introspection::AuthorityAuthentication};

use super::IntrospectionGuardError;

#[derive(Clone, Debug)]
pub struct IntrospectionState {
    pub(crate) config: Arc<RwLock<IntrospectionConfig>>,
}

#[derive(Debug)]
pub(crate) struct IntrospectionConfig {
    pub(crate) authority: String,
    pub(crate) authentication: AuthorityAuthentication,
    pub(crate) introspection_uri: Option<IntrospectionUrl>,
    #[cfg(feature = "introspection_cache")]
    pub(crate) cache: Option<Box<dyn IntrospectionCache>>,
}

impl IntrospectionState {
    pub async fn get_introspection_uri(&self) -> Result<IntrospectionUrl, IntrospectionGuardError> {
        // First, check if we already have the URI (read lock)

        let config = self.config.read().await;
        if let Some(introspection_uri) = &config.introspection_uri {
            return Ok(introspection_uri.clone());
        }

        // Discover the URI
        let metadata = discover(&config.authority.clone()).await?;

        // Update the config (write lock)
        {
            let mut config = self.config.write().await;
            config.introspection_uri = metadata
                .additional_metadata()
                .introspection_endpoint
                .clone();

            match &config.introspection_uri {
                Some(uri) => Ok(uri.clone()),
                None => Err(IntrospectionGuardError::IntrospectionUriNotFound),
            }
        }
    }

    pub async fn get_health(&self) -> Result<(), anyhow::Error> {
        let config = self.config.read().await;
        discover(&config.authority.clone()).await?;
        Ok(())
    }
}
