use openidconnect::IntrospectionUrl;
use std::sync::Arc;
use tokio::sync::RwLock;
use zitadel::oidc::{
    discovery::discover,
    introspection::{cache::IntrospectionCache, AuthorityAuthentication},
};

use crate::http_api::authentication::user::IntrospectionGuardError;

#[derive(Clone, Debug)]
pub struct IntrospectionState {
    pub config: Arc<RwLock<IntrospectionConfig>>,
}

#[derive(Debug)]
pub struct IntrospectionConfig {
    pub authority: String,
    pub authentication: AuthorityAuthentication,
    pub introspection_uri: Option<IntrospectionUrl>,
    pub cache: Option<Box<dyn IntrospectionCache>>,
}

impl IntrospectionState {
    pub async fn get_introspection_uri(&self) -> Result<IntrospectionUrl, IntrospectionGuardError> {
        let config = self.config.read().await;
        if let Some(introspection_uri) = &config.introspection_uri {
            return Ok(introspection_uri.clone());
        }

        let metadata = discover(&config.authority.clone()).await?;

        drop(config);

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
