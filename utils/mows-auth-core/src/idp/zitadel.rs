//! Zitadel implementation of [`TokenIntrospector`].
//!
//! Ports filez's `handle_oidc` + `IntrospectionState` + builder into
//! a single self-contained type that satisfies the engine's trait
//! contract. Filez today still uses its own copy; the migration is
//! Phase 1.x — when filez's middleware switches to call this impl
//! through `Arc<dyn TokenIntrospector>`, the local copy goes away.
//!
//! Implementation notes:
//!   * The Zitadel-side discovery URL is fetched lazily and cached
//!     in-process. First call to `introspect()` triggers it; subsequent
//!     calls reuse the URL.
//!   * The introspection cache is the same trait Zitadel ships
//!     (`zitadel::oidc::introspection::cache::IntrospectionCache`).
//!     Each instance gets its own optional cache; pass `None` to
//!     disable caching.
//!   * IdP-specific claims (`project_roles`, `metadata`,
//!     `resource_owner_*`) flow through `IntrospectedUser.extra` as
//!     a JSON object so service-side SuperAdmin promotion (filez)
//!     keeps working unchanged.
//!   * SEC-2 enforcement: [`enforce_extra_depth`] runs after mapping.
//!     The raw-body byte cap is documented in the trait contract;
//!     enforcing it requires direct HTTP control (the upstream
//!     `zitadel::introspect` doesn't expose a cap). Tracked as a
//!     follow-up — see the comment on `introspect_via_zitadel_crate`
//!     below.

use crate::idp::{
    enforce_extra_depth, IntrospectedUser, IntrospectionError, IntrospectionResult,
    TokenIntrospector,
};
use async_trait::async_trait;
use openidconnect::IntrospectionUrl;
use openidconnect::TokenIntrospectionResponse;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use zitadel::oidc::{
    discovery::discover,
    introspection::{
        cache::IntrospectionCache, introspect, AuthorityAuthentication,
        ZitadelIntrospectionResponse,
    },
};

/// Configuration captured at builder time. Held behind an RwLock so the
/// lazily-discovered `introspection_uri` can be filled in on first use
/// without needing a mutable reference at every call site.
struct ZitadelConfig {
    /// OIDC issuer URL (e.g. `https://zitadel.example.com`).
    authority: String,
    /// How this instance authenticates itself to Zitadel for
    /// introspection — Basic auth (client_id/secret) or JWTProfile
    /// (RSA-signed assertion).
    authentication: AuthorityAuthentication,
    /// Lazily populated from the OIDC discovery document on first call.
    introspection_uri: Option<IntrospectionUrl>,
    /// Optional cache (TTL respects `exp`; see Zitadel's
    /// IntrospectionCache trait docs).
    cache: Option<Box<dyn IntrospectionCache>>,
}

/// Zitadel-backed [`TokenIntrospector`].
///
/// Construct via [`ZitadelIntrospector::new`]. Idiomatic shape:
/// ```ignore
/// let introspector = ZitadelIntrospector::new(
///     mows_auth_core::ZITADEL_IDP_ID,
///     "https://zitadel.example.com".into(),
///     AuthorityAuthentication::Basic { client_id, client_secret },
///     Some(Box::new(InMemoryIntrospectionCache::default())),
/// );
/// let result = introspector.introspect(token).await?;
/// ```
pub struct ZitadelIntrospector {
    idp_id: Uuid,
    config: Arc<RwLock<ZitadelConfig>>,
}

impl std::fmt::Debug for ZitadelIntrospector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Authentication carries secrets; do NOT Debug-format it.
        f.debug_struct("ZitadelIntrospector")
            .field("idp_id", &self.idp_id)
            .finish_non_exhaustive()
    }
}

impl ZitadelIntrospector {
    pub fn new(
        idp_id: Uuid,
        authority: String,
        authentication: AuthorityAuthentication,
        cache: Option<Box<dyn IntrospectionCache>>,
    ) -> Self {
        Self {
            idp_id,
            config: Arc::new(RwLock::new(ZitadelConfig {
                authority,
                authentication,
                introspection_uri: None,
                cache,
            })),
        }
    }

    /// Lazily fetch and cache the introspection URL from the OIDC
    /// discovery document.
    async fn get_introspection_uri(&self) -> Result<IntrospectionUrl, IntrospectionError> {
        {
            let config = self.config.read().await;
            if let Some(uri) = &config.introspection_uri {
                return Ok(uri.clone());
            }
        }
        let authority = {
            let config = self.config.read().await;
            config.authority.clone()
        };
        let metadata = discover(&authority).await.map_err(|source| {
            IntrospectionError::Unreachable(format!("discovery failed for {authority}: {source}"))
        })?;
        let mut config = self.config.write().await;
        config.introspection_uri = metadata
            .additional_metadata()
            .introspection_endpoint
            .clone();
        config
            .introspection_uri
            .clone()
            .ok_or_else(|| {
                IntrospectionError::Malformed(format!(
                    "discovery document for {authority} did not advertise an introspection endpoint"
                ))
            })
    }

    /// Wrapper around `zitadel::introspect` plus the cache layer.
    ///
    /// TODO: once the upstream `introspect()` accepts a response-size
    /// cap (or we wire reqwest directly), enforce
    /// `MAX_INTROSPECTION_BODY_BYTES` here. Until then, depth is
    /// enforced post-parse via `enforce_extra_depth`.
    async fn introspect_via_zitadel_crate(
        &self,
        token: &str,
    ) -> Result<ZitadelIntrospectionResponse, IntrospectionError> {
        // Cache lookup first.
        let cached = {
            let config = self.config.read().await;
            match &config.cache {
                Some(cache) => cache.get(token).await,
                None => None,
            }
        };
        if let Some(cached) = cached {
            return Ok(cached);
        }

        let introspection_uri = self.get_introspection_uri().await?;
        let (authority, authentication, has_cache) = {
            let config = self.config.read().await;
            (
                config.authority.clone(),
                config.authentication.clone(),
                config.cache.is_some(),
            )
        };

        let response = introspect(
            introspection_uri.as_str(),
            &authority,
            &authentication,
            token,
        )
        .await
        .map_err(|source| {
            // The zitadel crate's IntrospectionError mixes network
            // failures and response-shape errors; map both to
            // Unreachable for now (fail-closed → 503). A future
            // refinement could pattern-match the source to distinguish
            // 4xx-from-Zitadel (would be Malformed) from network
            // failure (Unreachable).
            IntrospectionError::Unreachable(format!("zitadel introspection failed: {source}"))
        })?;

        // Cache only active tokens. Zitadel ships expiry in the response.
        if has_cache && response.active() {
            let config = self.config.read().await;
            if let Some(cache) = &config.cache {
                cache.set(token, response.clone()).await;
            }
        }

        Ok(response)
    }
}

#[async_trait]
impl TokenIntrospector for ZitadelIntrospector {
    fn idp_id(&self) -> Uuid {
        self.idp_id
    }

    #[tracing::instrument(level = "trace", skip(self, bearer_token))]
    async fn introspect(
        &self,
        bearer_token: &str,
    ) -> Result<IntrospectionResult, IntrospectionError> {
        let response = self.introspect_via_zitadel_crate(bearer_token).await?;
        let result = map_zitadel_response(response)?;
        // SEC-2: depth cap on the IdP-specific blobs after mapping.
        if let Some(user) = &result.user {
            enforce_extra_depth(&user.extra)?;
        }
        enforce_extra_depth(&result.extra)?;
        Ok(result)
    }

    async fn health_check(&self) -> Result<(), IntrospectionError> {
        let authority = {
            let config = self.config.read().await;
            config.authority.clone()
        };
        discover(&authority).await.map_err(|source| {
            IntrospectionError::Unreachable(format!(
                "zitadel discovery probe failed for {authority}: {source}"
            ))
        })?;
        Ok(())
    }
}

/// Translate a Zitadel introspection response into the canonical
/// engine shape. Pure function — kept out of the trait impl so it's
/// independently unit-testable without a live introspector.
fn map_zitadel_response(
    response: ZitadelIntrospectionResponse,
) -> Result<IntrospectionResult, IntrospectionError> {
    let active = response.active();
    let client_id = response
        .client_id()
        .map(|id| id.as_str().to_string())
        .unwrap_or_default();
    let expires_at = response.exp();
    let scopes = response
        .scopes()
        .map(|s| s.iter().map(|sc| sc.as_str().to_string()).collect())
        .unwrap_or_default();

    // User claims, when present.
    let user = if active {
        let sub = response.sub().map(|s| s.to_string());
        sub.map(|sub| {
            let extra_fields = response.extra_fields();
            let user_extra = serde_json::json!({
                "project_roles": extra_fields.project_roles,
                "metadata": extra_fields.metadata,
                "resource_owner_id": extra_fields.resource_owner_id,
                "resource_owner_name": extra_fields.resource_owner_name,
                "resource_owner_primary_domain": extra_fields.resource_owner_primary_domain,
                "given_name": extra_fields.given_name,
                "family_name": extra_fields.family_name,
            });
            IntrospectedUser {
                sub,
                name: extra_fields.name.clone(),
                preferred_username: extra_fields.preferred_username.clone(),
                // SEC: only surface email when verified.
                email: if extra_fields.email_verified.unwrap_or(false) {
                    extra_fields.email.clone()
                } else {
                    None
                },
                email_verified: extra_fields.email_verified.unwrap_or(false),
                locale: extra_fields.locale.clone(),
                extra: user_extra,
            }
        })
    } else {
        None
    };

    Ok(IntrospectionResult {
        client_id,
        user,
        active,
        expires_at,
        scopes,
        extra: serde_json::Value::Null,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use openidconnect::Scope;
    use std::collections::HashMap;
    use zitadel::oidc::introspection::ZitadelIntrospectionExtraTokenFields;

    fn active_response_with_project_roles() -> ZitadelIntrospectionResponse {
        let mut extra = ZitadelIntrospectionExtraTokenFields::default();
        extra.name = Some("Test User".to_string());
        extra.email = Some("test@example.com".to_string());
        extra.email_verified = Some(true);
        extra.locale = Some("en-US".to_string());
        let mut roles: HashMap<String, HashMap<String, String>> = HashMap::new();
        let mut admin_org: HashMap<String, String> = HashMap::new();
        admin_org.insert("filez-project".to_string(), "filez-org".to_string());
        roles.insert("admin".to_string(), admin_org);
        extra.project_roles = Some(roles);

        let mut r = ZitadelIntrospectionResponse::new(true, extra);
        r.set_client_id(Some(openidconnect::ClientId::new("client-abc".to_string())));
        r.set_sub(Some("user-123".to_string()));
        r.set_scopes(Some(vec![Scope::new("openid".to_string())]));
        r
    }

    fn inactive_response() -> ZitadelIntrospectionResponse {
        ZitadelIntrospectionResponse::new(
            false,
            ZitadelIntrospectionExtraTokenFields::default(),
        )
    }

    #[test]
    fn maps_active_response_with_user_and_project_roles() {
        let result =
            map_zitadel_response(active_response_with_project_roles()).expect("mapping succeeds");
        assert!(result.active);
        assert_eq!(result.client_id, "client-abc");
        let user = result.user.expect("active+sub yields Some(user)");
        assert_eq!(user.sub, "user-123");
        assert_eq!(user.name.as_deref(), Some("Test User"));
        assert_eq!(user.email.as_deref(), Some("test@example.com"));
        assert!(user.email_verified);
        // SuperAdmin bootstrap path: project_roles["admin"] reachable
        // via the extra blob, mirrors filez's `is_super_admin` lookup.
        let admin = user.extra.get("project_roles").and_then(|v| v.get("admin"));
        assert!(admin.is_some(), "project_roles[admin] must survive mapping");
    }

    #[test]
    fn drops_unverified_email() {
        let mut extra = ZitadelIntrospectionExtraTokenFields::default();
        extra.email = Some("unverified@example.com".to_string());
        extra.email_verified = Some(false);
        let mut r = ZitadelIntrospectionResponse::new(true, extra);
        r.set_sub(Some("user-xyz".to_string()));
        let result = map_zitadel_response(r).unwrap();
        let user = result.user.unwrap();
        assert!(
            user.email.is_none(),
            "unverified email must not surface (defense-in-depth against IdP misconfig)"
        );
        assert!(!user.email_verified);
    }

    #[test]
    fn inactive_response_has_no_user() {
        let result = map_zitadel_response(inactive_response()).unwrap();
        assert!(!result.active);
        assert!(result.user.is_none());
    }

    #[test]
    fn active_without_sub_has_no_user() {
        // Defensive: Zitadel always issues `sub` for user-bearing tokens
        // and never for client-credentials. The mapping respects this.
        let r = ZitadelIntrospectionResponse::new(
            true,
            ZitadelIntrospectionExtraTokenFields::default(),
        );
        let result = map_zitadel_response(r).unwrap();
        assert!(result.active);
        assert!(
            result.user.is_none(),
            "Client Credentials response (no sub) must yield user = None"
        );
    }

    #[test]
    fn debug_does_not_leak_credentials() {
        let introspector = ZitadelIntrospector::new(
            crate::ZITADEL_IDP_ID,
            "https://example.com".to_string(),
            AuthorityAuthentication::Basic {
                client_id: "my-client".to_string(),
                client_secret: "SUPER_SECRET_DO_NOT_LEAK".to_string(),
            },
            None,
        );
        let debug = format!("{introspector:?}");
        assert!(
            !debug.contains("SUPER_SECRET_DO_NOT_LEAK"),
            "ZitadelIntrospector Debug must not leak client_secret: {debug}"
        );
    }
}
