//! Token-introspection glue.
//!
//! Filez delegates the actual introspection to mows-auth-core's
//! `TokenIntrospector` trait — see `state.rs::ServerState::introspector`
//! and AUTHENTICATION.md §2 "Pluggable IdP". This file holds the small
//! bit that maps the engine's canonical `IntrospectionResult` back to
//! the filez-local `IntrospectedUser` struct that downstream code
//! (`FilezUser::apply_one`, the SuperAdmin bootstrap, …) still
//! consumes.
//!
//! Once those downstream callers migrate to the engine type directly,
//! the local `IntrospectedUser` and this glue both go away. See
//! `.plans/authorization/REVIEW-vs-mows-vision.md` finding SEC-3.

use std::collections::HashMap;

use mows_auth_core::{IntrospectionError as EngineIntrospectionError, TokenIntrospector};

use crate::errors::FilezError;
use crate::models::apps::MowsApp;
use crate::models::users::FilezUser;

#[derive(Debug, thiserror::Error)]
pub enum IntrospectionGuardError {
    #[error("Invalid Authorization header {0}")]
    InvalidHeader(String),

    #[error("Introspection failed: {0}")]
    Introspection(String),

    #[error("Inactive user")]
    Inactive,

    #[error("No user ID found in introspection response")]
    NoUserId,
}

impl From<EngineIntrospectionError> for IntrospectionGuardError {
    fn from(err: EngineIntrospectionError) -> Self {
        match err {
            EngineIntrospectionError::InvalidToken => {
                IntrospectionGuardError::InvalidHeader("invalid bearer token".to_string())
            }
            EngineIntrospectionError::Inactive => IntrospectionGuardError::Inactive,
            EngineIntrospectionError::Unreachable(msg)
            | EngineIntrospectionError::Malformed(msg) => {
                IntrospectionGuardError::Introspection(msg)
            }
        }
    }
}

#[derive(Clone, Debug)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub requesting_app: MowsApp,
}

/// Filez-side mirror of the OIDC introspection result. Downstream
/// callers (especially `FilezUser::apply_one`) read `project_roles`
/// directly to bootstrap the SuperAdmin role. Until those callers
/// migrate to `mows_auth_core::IntrospectedUser`, the engine result
/// is converted back into this shape here.
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

/// Run token introspection through the engine's trait and adapt the
/// result to the filez-local `IntrospectedUser`. Active tokens with no
/// `sub` (Client Credentials grants) surface as
/// `IntrospectionGuardError::NoUserId` — matches the previous filez
/// behaviour where `handle_oidc` rejected user-less tokens at this
/// layer because filez handlers downstream of this point require a user.
#[tracing::instrument(level = "trace", skip(bearer_token, introspector))]
pub async fn introspect_via_engine(
    bearer_token: &str,
    introspector: &dyn TokenIntrospector,
) -> Result<IntrospectedUser, FilezError> {
    let result = introspector
        .introspect(bearer_token)
        .await
        .map_err(IntrospectionGuardError::from)?;

    if !result.active {
        return Err(FilezError::IntrospectionGuardError(
            IntrospectionGuardError::Inactive,
        ));
    }

    let user = result
        .user
        .ok_or(FilezError::IntrospectionGuardError(
            IntrospectionGuardError::NoUserId,
        ))?;

    // Unpack the IdP-specific extras packed into `user.extra` by
    // `mows_auth_core::idp::zitadel::map_zitadel_response`. The keys
    // are stable per AUTHENTICATION.md §2; missing values surface as
    // None.
    fn extract_hashmap_string(
        extra: &serde_json::Value,
        key: &str,
    ) -> Option<HashMap<String, String>> {
        serde_json::from_value(extra.get(key)?.clone()).ok()
    }
    fn extract_hashmap_hashmap_string(
        extra: &serde_json::Value,
        key: &str,
    ) -> Option<HashMap<String, HashMap<String, String>>> {
        serde_json::from_value(extra.get(key)?.clone()).ok()
    }
    fn extract_string(extra: &serde_json::Value, key: &str) -> Option<String> {
        extra.get(key)?.as_str().map(|s| s.to_string())
    }

    Ok(IntrospectedUser {
        user_id: user.sub,
        username: user.preferred_username.clone(),
        name: user.name,
        given_name: extract_string(&user.extra, "given_name"),
        family_name: extract_string(&user.extra, "family_name"),
        preferred_username: user.preferred_username,
        email: user.email,
        email_verified: Some(user.email_verified),
        locale: user.locale,
        project_roles: extract_hashmap_hashmap_string(&user.extra, "project_roles"),
        metadata: extract_hashmap_string(&user.extra, "metadata"),
    })
}
