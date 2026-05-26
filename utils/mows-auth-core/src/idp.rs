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

/// Maximum size in bytes of a single introspection response body the
/// engine will deserialise. Caps the attack surface of a compromised
/// or malicious IdP returning a giant payload (SEC-2). `TokenIntrospector`
/// implementations MUST enforce this before passing the bytes to
/// `serde_json`. 32 KiB comfortably fits a well-formed Zitadel /
/// Keycloak / Authentik response with `project_roles`, `realm_access`,
/// and the usual claims; anything larger is an abuse signal.
pub const MAX_INTROSPECTION_BODY_BYTES: usize = 32 * 1024;

/// Maximum nesting depth the engine will accept inside
/// `IntrospectionResult.extra` and `IntrospectedUser.extra`. serde_json
/// has its own internal recursion limit (RECURSION_LIMIT = 128) that
/// guards stack safety; this is a tighter MOWS-side cap because no
/// real IdP issues claims more than a handful of levels deep. Impls
/// MUST check via [`enforce_extra_depth`] after deserialising.
pub const MAX_EXTRA_JSON_DEPTH: usize = 8;

/// Return an error if `value`'s nesting depth exceeds
/// [`MAX_EXTRA_JSON_DEPTH`]. Use after deserialising a claims blob you
/// intend to put into `extra`.
pub fn enforce_extra_depth(value: &serde_json::Value) -> Result<(), IntrospectionError> {
    fn depth(v: &serde_json::Value) -> usize {
        match v {
            serde_json::Value::Object(map) => {
                1 + map.values().map(depth).max().unwrap_or(0)
            }
            serde_json::Value::Array(arr) => 1 + arr.iter().map(depth).max().unwrap_or(0),
            _ => 0,
        }
    }
    let observed = depth(value);
    if observed > MAX_EXTRA_JSON_DEPTH {
        return Err(IntrospectionError::Malformed(format!(
            "extra claims depth {observed} exceeds MAX_EXTRA_JSON_DEPTH={MAX_EXTRA_JSON_DEPTH}"
        )));
    }
    Ok(())
}

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

    /// IdP-specific claims that don't fit any of the canonical fields
    /// above. The engine treats this blob as opaque; services that
    /// care (e.g. filez reading Zitadel `project_roles` to bootstrap
    /// the SuperAdmin role) can pull values out by key. Defaults to
    /// `Value::Null` for IdPs that have nothing extra to surface.
    #[serde(default)]
    pub extra: serde_json::Value,
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

    /// IdP-specific user claims (Zitadel `project_roles`, Keycloak
    /// `realm_access`, …). Engine treats as opaque. Services that
    /// need a particular claim extract it by key. See
    /// [`IntrospectionResult::extra`] for the same rationale at the
    /// token level.
    #[serde(default)]
    pub extra: serde_json::Value,
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
/// Implementations MUST enforce the size and depth caps documented in
/// this module — [`MAX_INTROSPECTION_BODY_BYTES`] on the raw response
/// body (before parsing) and [`enforce_extra_depth`] on the populated
/// `extra` value. Skipping these turns a compromised IdP into a DoS
/// vector for every API in the cluster (SEC-2).
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
                    extra: serde_json::Value::Null,
                }),
                active: true,
                expires_at: None,
                scopes: vec!["openid".to_string()],
                extra: serde_json::Value::Null,
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

    #[test]
    fn extra_claims_roundtrip_via_serde() {
        // Mimics how filez will pull Zitadel `project_roles` out of
        // `user.extra` once the ZitadelIntrospector lands.
        let user = IntrospectedUser {
            sub: "user-1".to_string(),
            name: None,
            preferred_username: None,
            email: None,
            email_verified: false,
            locale: None,
            extra: serde_json::json!({
                "project_roles": {
                    "admin": { "filez-project": "filez-org" }
                }
            }),
        };

        let project_roles = user.extra.get("project_roles")
            .and_then(|v| v.get("admin"));
        assert!(project_roles.is_some(),
            "consumers must be able to pull IdP-specific claims back out by key");
    }

    #[test]
    fn enforce_extra_depth_allows_shallow_claims() {
        // Realistic Zitadel project_roles shape — 4 levels deep, well
        // under the cap. Must pass.
        let value = serde_json::json!({
            "project_roles": {
                "admin": { "filez-project": "filez-org" }
            },
            "metadata": { "tenant_id": "abc" }
        });
        enforce_extra_depth(&value).expect("realistic shape must pass");
    }

    #[test]
    fn enforce_extra_depth_rejects_deeply_nested_claims() {
        // Build N levels of nested objects. SEC-2 attack vector: a
        // compromised IdP returns a payload that, if cached or
        // serialised repeatedly, exhausts memory.
        let mut value = serde_json::Value::Object(serde_json::Map::new());
        for _ in 0..(MAX_EXTRA_JSON_DEPTH + 5) {
            let mut wrap = serde_json::Map::new();
            wrap.insert("n".to_string(), value);
            value = serde_json::Value::Object(wrap);
        }
        let err = enforce_extra_depth(&value).expect_err("deep nesting must fail");
        match err {
            IntrospectionError::Malformed(msg) => {
                assert!(msg.contains("depth"), "error must mention depth: {msg}")
            }
            other => panic!("expected Malformed, got {other:?}"),
        }
    }

    #[test]
    fn enforce_extra_depth_treats_arrays_as_depth() {
        // Arrays count toward depth too — `[[[[…]]]]` is just as
        // pathological as nested objects.
        let mut value = serde_json::Value::Null;
        for _ in 0..(MAX_EXTRA_JSON_DEPTH + 1) {
            value = serde_json::Value::Array(vec![value]);
        }
        enforce_extra_depth(&value).expect_err("array-nested attack must fail");
    }

    #[test]
    fn max_introspection_body_bytes_is_sane() {
        // Belt and braces: the constant must be small enough to be a
        // meaningful cap and large enough for real responses. Zitadel
        // introspection bodies in the wild are 1–4 KiB; Keycloak with
        // realm_access can reach ~10 KiB.
        assert!(MAX_INTROSPECTION_BODY_BYTES >= 8 * 1024);
        assert!(MAX_INTROSPECTION_BODY_BYTES <= 256 * 1024);
    }

    #[test]
    fn introspection_result_extra_defaults_to_null_when_absent_from_json() {
        // Old persisted introspection responses (cached via serde) that
        // pre-date the `extra` field must still deserialize cleanly —
        // tests the `#[serde(default)]` on both extras.
        let json = serde_json::json!({
            "client_id": "c",
            "user": null,
            "active": true,
            "expires_at": null,
            "scopes": []
        });
        let result: IntrospectionResult = serde_json::from_value(json)
            .expect("backwards-compat: missing extra must default to Null");
        assert_eq!(result.extra, serde_json::Value::Null);
    }
}
