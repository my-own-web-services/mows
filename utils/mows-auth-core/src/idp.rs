//! Token introspection abstraction — the IdP-pluggable layer described
//! in AUTHENTICATION.md §2.
//!
//! Middleware in each MOWS service holds an
//! `Arc<dyn TokenIntrospector>` (or a registry of them, once a second
//! IdP is wired up), calls [`TokenIntrospector::introspect`] on every
//! authenticated request, then resolves the resulting
//! [`IntrospectionResult`] to `mows_auth.users` and `mows_auth.apps`
//! rows via the `(idp_id, external_*_id)` composite key.
//!
//! v1 has exactly one implementation (Zitadel). The trait exists so a
//! v2 IdP (Keycloak, Authentik, …) only needs a second impl — no
//! schema change, no engine change. See AUTHENTICATION.md §2 for the
//! schema-cost rationale.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// What introspection produces. IdP-agnostic — middleware never has to
/// know whether the token came from Zitadel, Keycloak, or anywhere
/// else.
///
/// The mapping back to MOWS tables happens at the caller:
///   * `client_id` + `idp_id` → `mows_auth.apps` row
///   * `user.sub` + `idp_id` → `mows_auth.users` row (if `user` is `Some`)
///
/// `user` is `None` for Client Credentials grants (backend apps and
/// API-to-API calls; see AUTHENTICATION.md §5 patterns 3 and 5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntrospectionResult {
    /// OIDC `client_id` / `azp` — always present, identifies the app
    /// the token was issued to.
    pub client_id: String,

    /// User identity, present only when the token was issued under a
    /// user-bearing flow (Authorization Code + PKCE, …). Absent for
    /// Client Credentials grants.
    pub user: Option<IntrospectedUser>,

    /// `active = false` means the token is expired, revoked, or
    /// otherwise rejected by the IdP. Middleware must treat
    /// `Ok(IntrospectionResult { active: false, .. })` the same as
    /// `Err(IntrospectionError::Inactive)`.
    pub active: bool,

    /// Token expiry as reported by the IdP (`exp` claim). Used by
    /// long-lived WebSocket connections to schedule re-introspection
    /// before expiry — see AUTHENTICATION.md §6.2.
    pub expires_at: Option<DateTime<Utc>>,

    /// OAuth scopes granted to the token. MOWS authorization uses the
    /// `access_policies` table, not scopes, but they're surfaced for
    /// audit and for IdP-specific behaviour (e.g. enforcing that a SPA
    /// requested the right `mows-*` scopes for its target APIs).
    pub scopes: Vec<String>,
}

/// User identity carried in an access token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntrospectedUser {
    /// Stable user identifier issued by the IdP (`sub` claim). Joined
    /// against `mows_auth.users.external_user_id` under the same
    /// `idp_id` as the introspector that produced this row.
    pub sub: String,

    /// Display name (`name` claim or equivalent). May be empty.
    pub name: Option<String>,

    /// Preferred username (`preferred_username` claim).
    pub preferred_username: Option<String>,

    /// Verified email — only populated when the IdP reports
    /// `email_verified = true`. Unverified emails are deliberately
    /// dropped here so MOWS never trusts them.
    pub email: Option<String>,

    /// `true` iff the IdP returned `email_verified = true`.
    pub email_verified: bool,

    /// User-preferred locale, used by the manager UI to pick a default
    /// language on first login.
    pub locale: Option<String>,
}

/// Errors a `TokenIntrospector` can return. Middleware translates
/// these to HTTP status codes (see AUTHENTICATION.md §9
/// "Failure modes").
#[derive(Debug, thiserror::Error)]
pub enum IntrospectionError {
    /// The `Authorization: Bearer …` header was missing or malformed.
    #[error("invalid bearer token")]
    InvalidToken,

    /// The IdP reported `active = false` — expired, revoked, or never
    /// valid.
    #[error("token inactive (expired or revoked)")]
    Inactive,

    /// The introspection endpoint is unreachable, returning 5xx, or
    /// otherwise failed at the network layer. Fail-closed: callers
    /// must return 503, not 401, so retries succeed once the IdP is
    /// back.
    #[error("introspection endpoint unreachable: {0}")]
    Unreachable(String),

    /// The introspection response parsed as JSON but did not contain
    /// the fields this impl expects. Indicates an IdP misconfig or a
    /// version mismatch — never a client error.
    #[error("malformed introspection response: {0}")]
    Malformed(String),
}

/// IdP-agnostic token introspection.
///
/// Each registered IdP provides one implementation. The middleware
/// looks up the right impl by [`TokenIntrospector::idp_id`] (in v1
/// there's only one, so the lookup is trivial).
///
/// Implementations are responsible for:
///   * caching introspection results (typical TTL: minutes)
///   * picking the discovery / introspection endpoint from
///     `mows_auth.idp_providers.discovery_url`
///   * mapping IdP-specific claims onto the canonical
///     [`IntrospectionResult`] shape
///
/// Implementations must NOT touch `mows_auth.users` or
/// `mows_auth.apps` — that mapping happens at the caller so the trait
/// stays connection-pool-agnostic.
#[async_trait]
pub trait TokenIntrospector: Send + Sync {
    /// The IdP this introspector is bound to. Matches
    /// `mows_auth.idp_providers.id`.
    fn idp_id(&self) -> Uuid;

    /// Validate the bearer token and return the structured result.
    /// `bearer_token` is the raw token (no `Bearer ` prefix).
    async fn introspect(
        &self,
        bearer_token: &str,
    ) -> Result<IntrospectionResult, IntrospectionError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal mock used by other test modules in this crate (and by
    /// downstream services) that need an introspector without hitting
    /// a real IdP. Returns the same canned result for every token.
    pub struct StubIntrospector {
        pub idp: Uuid,
        pub result: IntrospectionResult,
    }

    #[async_trait]
    impl TokenIntrospector for StubIntrospector {
        fn idp_id(&self) -> Uuid {
            self.idp
        }
        async fn introspect(
            &self,
            _bearer_token: &str,
        ) -> Result<IntrospectionResult, IntrospectionError> {
            Ok(self.result.clone())
        }
    }

    #[tokio::test]
    async fn stub_returns_canned_result() {
        let stub = StubIntrospector {
            idp: crate::ZITADEL_IDP_ID,
            result: IntrospectionResult {
                client_id: "test-client".to_string(),
                user: Some(IntrospectedUser {
                    sub: "user-123".to_string(),
                    name: Some("Test User".to_string()),
                    preferred_username: None,
                    email: Some("test@example.com".to_string()),
                    email_verified: true,
                    locale: None,
                }),
                active: true,
                expires_at: None,
                scopes: vec!["openid".to_string()],
            },
        };

        let result = stub.introspect("ignored").await.expect("stub never fails");
        assert!(result.active);
        assert_eq!(result.client_id, "test-client");
        assert_eq!(stub.idp_id(), crate::ZITADEL_IDP_ID);
        let user = result.user.expect("stub returns Some(user)");
        assert_eq!(user.sub, "user-123");
        assert!(user.email_verified);
    }
}
