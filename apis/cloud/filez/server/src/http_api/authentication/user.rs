use axum::extract::FromRef;
use axum_extra::headers::authorization::Bearer;
use openidconnect::TokenIntrospectionResponse;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;
use tracing::{span, trace, Level};
use zitadel::oidc::discovery::DiscoveryError;
use zitadel::oidc::introspection::introspect;

use crate::errors::FilezError;
use crate::http_api::authentication::state::IntrospectionState;
use crate::models::apps::MowsApp;
use crate::models::users::FilezUser;

#[derive(Debug, thiserror::Error)]
pub enum IntrospectionGuardError {
    #[error("Invalid Authorization header {0}")]
    InvalidHeader(String),

    #[error("Introspection failed: {0}")]
    Introspection(String),

    #[error("Introspection URI not found in discovery document")]
    IntrospectionUriNotFound,

    #[error("Inactive user")]
    Inactive,

    #[error("No user ID found in introspection response")]
    NoUserId,

    #[error("Configuration lock error")]
    ConfigLockError,

    #[error(transparent)]
    Discovery(#[from] DiscoveryError),
}

#[derive(Clone)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub requesting_app: MowsApp,
}

#[derive(Debug, Clone)]
pub struct IntrospectedUser {
    /// UserID of the introspected user (OIDC Field "sub").
    pub user_id: String,
    pub username: Option<String>,
    pub name: Option<String>,
    pub given_name: Option<String>,
    pub family_name: Option<String>,
    pub preferred_username: Option<String>,
    pub email: Option<String>,
    pub email_verified: Option<bool>,
    pub locale: Option<String>,
    pub project_roles: Option<HashMap<String, HashMap<String, String>>>,
    pub metadata: Option<HashMap<String, String>>,
}

pub async fn handle_oidc(
    bearer: Bearer,
    state: &IntrospectionState,
) -> Result<IntrospectedUser, FilezError> {
    let span = span!(Level::TRACE, "IntrospectionGuard");
    let _enter = span.enter();

    let state = IntrospectionState::from_ref(state);
    trace!("Extracting introspected user");

    let introspection_uri = state.get_introspection_uri().await?;

    let response = {
        let span = span!(Level::TRACE, "IntrospectionCache");
        let _enter = span.enter();
        trace!("Introspection cache feature enabled, checking cache.");
        let token = bearer.token();

        // First check cache if it exists
        let cached_result = {
            let config = state.config.read().await;
            if let Some(cache) = config.cache.as_deref() {
                cache.get(token).await
            } else {
                tracing::error!("Introspection cache feature enabled, but no cache configured!");
                None
            }
        };
        if cached_result.is_some() {
            trace!("Found cached introspection response for token");
        } else {
            trace!("No cached introspection response found for token");
        }

        match cached_result {
            Some(cached_response) => Ok(cached_response),
            None => {
                // Extract values needed for introspection
                let (authority, authentication, has_cache) = {
                    let config = state.config.read().await;
                    (
                        config.authority.clone(),
                        config.authentication.clone(),
                        config.cache.is_some(),
                    )
                };

                trace!("No cached response, performing introspection.",);

                let res = introspect(
                    introspection_uri.as_str(),
                    &authority,
                    &authentication,
                    token,
                )
                .await;

                // Cache the result if we have a cache and the introspection succeeded
                if has_cache && res.is_ok() {
                    let config = state.config.read().await;
                    if let (Some(cache), Ok(response)) = (config.cache.as_deref(), &res) {
                        cache.set(token, response.clone()).await;
                    }
                }

                res
            }
        }
    };

    match response {
        Ok(res) => match res.active() {
            true => Ok(IntrospectedUser {
                user_id: res
                    .sub()
                    .map(|s| s.to_string())
                    .ok_or(IntrospectionGuardError::NoUserId)?,
                username: res.username().map(|s| s.to_string()),
                name: res.extra_fields().name.clone(),
                given_name: res.extra_fields().given_name.clone(),
                family_name: res.extra_fields().family_name.clone(),
                preferred_username: res.extra_fields().preferred_username.clone(),
                email: res.extra_fields().email.clone(),
                email_verified: res.extra_fields().email_verified,
                locale: res.extra_fields().locale.clone(),
                project_roles: res.extra_fields().project_roles.clone(),
                metadata: res.extra_fields().metadata.clone(),
            }),
            false => Err(FilezError::IntrospectionGuardError(
                IntrospectionGuardError::Inactive,
            )),
        },
        Err(e) => Err(FilezError::IntrospectionGuardError(
            IntrospectionGuardError::Introspection(e.to_string()),
        )),
    }
}
