//! Filez-side glue around `mows_auth_core::TokenIntrospector`.
//!
//! Now that filez consumes the engine's `IntrospectedUser` directly
//! (the locally-typed copy was deleted in Cleanup-4), this module's
//! only job is to keep the FilezError variants that the rest of the
//! codebase already pattern-matches against. The error mapping is a
//! single From-style helper used by the middleware.

use mows_auth_core::IntrospectionError as EngineIntrospectionError;

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

/// Map an engine introspection error onto a `FilezError`. The
/// middleware calls this at the single point the engine error type
/// crosses into filez's error type.
pub fn introspection_error_into_filez(err: EngineIntrospectionError) -> FilezError {
    let guard = match err {
        EngineIntrospectionError::InvalidToken => {
            IntrospectionGuardError::InvalidHeader("invalid bearer token".to_string())
        }
        EngineIntrospectionError::Inactive => IntrospectionGuardError::Inactive,
        EngineIntrospectionError::Unreachable(msg)
        | EngineIntrospectionError::Malformed(msg) => {
            IntrospectionGuardError::Introspection(msg)
        }
    };
    FilezError::IntrospectionGuardError(guard)
}

#[derive(Clone, Debug)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub requesting_app: MowsApp,
}
