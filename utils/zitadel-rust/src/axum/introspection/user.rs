use std::collections::HashMap;
use std::fmt::Debug;

use crate::axum::introspection::IntrospectionState;
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
use custom_error::custom_error;
use openidconnect::TokenIntrospectionResponse;
use serde_json::json;

use crate::oidc::introspection::{introspect, IntrospectionError, ZitadelIntrospectionResponse};

custom_error! {
    /// Error type for guard related errors.
    pub IntrospectionGuardError
        MissingConfig = "no introspection config given to rocket managed state",
        Unauthorized = "no HTTP authorization header found",
        InvalidHeader = "authorization header is invalid",
        WrongScheme = "Authorization header is not a bearer token",
        Introspection{source: IntrospectionError} = "introspection returned an error: {source}",
        Inactive = "access token is inactive",
        NoUserId = "introspection result contained no user id",
        IntrospectionUriNotFound = "introspection uri not found in discovery document",
        ConfigLockError = "failed to acquire lock on introspection config",
}

impl IntoResponse for IntrospectionGuardError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_message) = match self {
            IntrospectionGuardError::MissingConfig => {
                (StatusCode::INTERNAL_SERVER_ERROR, "missing config")
            }
            IntrospectionGuardError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            IntrospectionGuardError::InvalidHeader => (StatusCode::BAD_REQUEST, "invalid header"),
            IntrospectionGuardError::WrongScheme => (StatusCode::BAD_REQUEST, "invalid schema"),
            IntrospectionGuardError::Introspection { source: _ } => {
                (StatusCode::BAD_REQUEST, "introspection error")
            }
            IntrospectionGuardError::Inactive => (StatusCode::FORBIDDEN, "user is inactive"),
            IntrospectionGuardError::NoUserId => (StatusCode::NOT_FOUND, "user was not found"),
            IntrospectionGuardError::IntrospectionUriNotFound => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "introspection uri not found",
            ),
            IntrospectionGuardError::ConfigLockError => {
                (StatusCode::INTERNAL_SERVER_ERROR, "config lock error")
            }
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

#[derive(Debug)]
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
            .map_err(|_| IntrospectionGuardError::InvalidHeader)?;

        let state = IntrospectionState::from_ref(state);

        let introspection_uri = state.get_introspection_uri().await?;

        #[cfg(feature = "introspection_cache")]
        let res = {
            let token = bearer.token();

            // First check cache if it exists
            let cached_result = {
                let config = state.config.read().await;
                if let Some(cache) = config.cache.as_deref() {
                    cache.get(token).await
                } else {
                    None
                }
            };

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
                let config = state
                    .config
                    .read()
                    .map_err(|_| IntrospectionGuardError::ConfigLockError)?;
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
                _ => Err(IntrospectionGuardError::NoUserId),
            },
            Err(source) => return Err(IntrospectionGuardError::Introspection { source }),
        };

        user
    }
}

impl From<ZitadelIntrospectionResponse> for IntrospectedUser {
    fn from(response: ZitadelIntrospectionResponse) -> Self {
        Self {
            user_id: response.sub().unwrap().to_string(),
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
