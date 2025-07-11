use std::collections::HashMap;
use std::fmt::Debug;

use crate::axum::introspection::IntrospectionState;
use crate::oidc::discovery::DiscoveryError;
use axum::http::StatusCode;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
    response::IntoResponse,
    Json, RequestPartsExt,
};
use axum_extra::headers::authorization::Bearer;
use axum_extra::headers::Authorization;
use axum_extra::TypedHeader;
use openidconnect::TokenIntrospectionResponse;
use serde_json::json;
use tracing::{span, Level};

use crate::oidc::introspection::{introspect, ZitadelIntrospectionResponse};

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

// implement for axum response
impl IntoResponse for IntrospectionGuardError {
    fn into_response(self) -> axum::response::Response {
        let status = match self {
            IntrospectionGuardError::InvalidHeader(_) => StatusCode::UNAUTHORIZED,
            IntrospectionGuardError::Introspection { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            IntrospectionGuardError::IntrospectionUriNotFound => StatusCode::INTERNAL_SERVER_ERROR,
            IntrospectionGuardError::Inactive => StatusCode::FORBIDDEN,
            IntrospectionGuardError::NoUserId => StatusCode::UNAUTHORIZED,
            IntrospectionGuardError::ConfigLockError => StatusCode::INTERNAL_SERVER_ERROR,
            IntrospectionGuardError::Discovery(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = Json(json!({
            "status": "Error",
            "message": self.to_string(),
            "data": null,
        }));

        (status, body).into_response()
    }
}

#[derive(Debug)]
pub struct IntrospectedUser {
    /// UserID of the introspected user (OIDC Field "sub").
    pub user_id: Option<String>,
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

impl<S> FromRequestParts<S> for IntrospectedUser
where
    IntrospectionState: FromRef<S> + 'static,
    S: Send + Sync,
{
    type Rejection = IntrospectionGuardError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|e| IntrospectionGuardError::InvalidHeader(e.to_string()))?;

        let span = span!(Level::TRACE, "IntrospectionGuard");
        let _enter = span.enter();

        let state = IntrospectionState::from_ref(state);
        tracing::trace!("Extracting introspected user");

        let introspection_uri = state.get_introspection_uri().await?;

        #[cfg(feature = "introspection_cache")]
        let res = {
            let span = span!(Level::TRACE, "IntrospectionCache");
            let _enter = span.enter();
            tracing::trace!("Introspection cache feature enabled, checking cache.");
            let token = bearer.token();

            // First check cache if it exists
            let cached_result = {
                let config = state.config.read().await;
                if let Some(cache) = config.cache.as_deref() {
                    cache.get(token).await
                } else {
                    tracing::error!(
                        "Introspection cache feature enabled, but no cache configured!"
                    );
                    None
                }
            };
            if cached_result.is_some() {
                tracing::trace!("Found cached introspection response for token");
            } else {
                tracing::trace!("No cached introspection response found for token");
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

                    tracing::trace!("No cached response, performing introspection.",);

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

        #[cfg(not(feature = "introspection_cache"))]
        let res = {
            // Extract values from config before async operations
            let (authority, authentication) = {
                let config = state.config.read()?;
                (config.authority.clone(), config.authentication.clone())
            }; // Lock is dropped here

            introspect(
                introspection_uri.as_str(),
                &authority,
                &authentication,
                bearer.token(),
            )
            .await
        };

        let user: Result<IntrospectedUser, IntrospectionGuardError> = match res {
            Ok(res) => match res.active() {
                true if res.sub().is_some() => Ok(res.into()),
                false => Err(IntrospectionGuardError::Inactive),
                _ => Ok(res.into()),
            },
            Err(e) => return Err(IntrospectionGuardError::Introspection(e.to_string())),
        };

        user
    }
}

impl From<ZitadelIntrospectionResponse> for IntrospectedUser {
    fn from(response: ZitadelIntrospectionResponse) -> Self {
        Self {
            user_id: response.sub().map(|s| s.to_string()),
            username: response.username().map(|s| s.to_string()),
            name: response.extra_fields().name.clone(),
            given_name: response.extra_fields().given_name.clone(),
            family_name: response.extra_fields().family_name.clone(),
            preferred_username: response.extra_fields().preferred_username.clone(),
            email: response.extra_fields().email.clone(),
            email_verified: response.extra_fields().email_verified,
            locale: response.extra_fields().locale.clone(),
            project_roles: response.extra_fields().project_roles.clone(),
            metadata: response.extra_fields().metadata.clone(),
        }
    }
}
