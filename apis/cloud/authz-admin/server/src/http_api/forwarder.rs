//! Shared building blocks for upstream-forwarding handlers.
//!
//! Both `explain` and `by_resource` (Phase 7 of the authorization
//! initiative) do the same dance: bound the inbound body, refuse
//! anonymous callers, then pass through a whitelisted set of
//! identity headers to one upstream. Extracting the dance here
//! keeps the two handlers slim and prevents drift — a change to
//! the identity-header set (e.g. a third upstream introducing
//! `x-pektin-user-id`) lands in one place.

use axum::body::{to_bytes, Body, Bytes};
use axum::http::{HeaderMap, HeaderValue};

use crate::errors::AuthzAdminError;

/// Maximum body size we accept on the inbound side. The explain and
/// by_resource payloads are small (`resource_type` + an id +
/// upstream key); a caller sending megabytes is misbehaving.
pub const MAX_BODY_BYTES: usize = 16 * 1024;

/// Identity-bearing headers the BFF forwards downstream. The set is
/// also the set we require at least one of for any non-health,
/// non-listing endpoint — see [`require_identity_header`].
///
/// Specifically NOT a passthrough-all design: any header outside
/// this list (cookies, ingress request-id metadata, traefik routing
/// hints) is stripped to prevent a misconfigured ingress from
/// forwarding a `cookie: _admin_session=...` to an upstream as if
/// the caller had supplied it.
pub const IDENTITY_HEADERS: &[&str] = &[
    "authorization",
    "x-realtime-user-id",
    "x-filez-user-id",
];

/// Pull the inbound body and refuse oversized payloads. Wraps
/// axum's [`to_bytes`] with the [`MAX_BODY_BYTES`] cap so a single
/// constant governs every forwarding endpoint.
pub async fn read_bounded_body(body: Body) -> Result<Bytes, AuthzAdminError> {
    to_bytes(body, MAX_BODY_BYTES)
        .await
        .map_err(|e| AuthzAdminError::BadRequest(format!("body read: {e}")))
}

/// Refuse forwarding if the caller hasn't supplied at least one of
/// [`IDENTITY_HEADERS`]. The upstream services accept anonymous
/// callers (Subject::Anonymous matches only Public policies);
/// letting the BFF surface that result without an identity
/// assertion would let it serve as an anonymous fingerprinting
/// probe (review-1 SEC-2). The 401 here is defence-in-depth — the
/// upstreams' own /explain and /by_resource also refuse anonymous.
pub fn require_identity_header(headers: &HeaderMap) -> Result<(), AuthzAdminError> {
    let any_present = IDENTITY_HEADERS
        .iter()
        .any(|n| headers.contains_key(*n));
    if !any_present {
        return Err(AuthzAdminError::Unauthorized(
            "forwarding requires at least one identity header: Authorization \
             (production Bearer token) or x-realtime-user-id / \
             x-filez-user-id (dev). The BFF refuses to forward anonymous \
             requests so it can't be used as a fingerprinting probe — see \
             review-1 SEC-2."
                .to_string(),
        ));
    }
    Ok(())
}

/// Build the `HeaderMap` the BFF sends to the upstream: the
/// whitelisted identity headers from the caller plus
/// `content-type: application/json`. Anything not in
/// [`IDENTITY_HEADERS`] is dropped.
pub fn build_forwarding_headers(inbound: &HeaderMap) -> HeaderMap {
    let mut fwd = HeaderMap::new();
    for name in IDENTITY_HEADERS {
        if let Some(v) = inbound.get(*name) {
            fwd.insert(*name, v.clone());
        }
    }
    fwd.insert(
        "content-type",
        HeaderValue::from_static("application/json"),
    );
    fwd
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderName, HeaderValue};

    #[test]
    fn require_identity_header_accepts_any_known_header() {
        for name in IDENTITY_HEADERS {
            let mut headers = HeaderMap::new();
            headers.insert(
                HeaderName::from_static(name),
                HeaderValue::from_static("anything"),
            );
            require_identity_header(&headers)
                .unwrap_or_else(|e| panic!("{name} must be accepted, got {e:?}"));
        }
    }

    #[test]
    fn require_identity_header_rejects_unknown_only() {
        // A caller may set an x-request-id or similar tracking
        // header without authenticating. That must NOT count as
        // identity.
        let mut headers = HeaderMap::new();
        headers.insert(
            HeaderName::from_static("x-request-id"),
            HeaderValue::from_static("trace-1"),
        );
        let err = require_identity_header(&headers)
            .expect_err("must refuse without an identity header");
        match err {
            AuthzAdminError::Unauthorized(_) => {}
            other => panic!("expected Unauthorized, got {other:?}"),
        }
    }

    #[test]
    fn build_forwarding_headers_drops_cookies() {
        // SEC review pinpoint: a misconfigured ingress injecting
        // `cookie: _admin_session=...` must not reach the upstream.
        let mut inbound = HeaderMap::new();
        inbound.insert(
            HeaderName::from_static("authorization"),
            HeaderValue::from_static("Bearer xyz"),
        );
        inbound.insert(
            HeaderName::from_static("cookie"),
            HeaderValue::from_static("_admin_session=evil"),
        );
        inbound.insert(
            HeaderName::from_static("x-traefik-route"),
            HeaderValue::from_static("internal"),
        );
        let fwd = build_forwarding_headers(&inbound);
        assert!(fwd.contains_key("authorization"));
        assert!(!fwd.contains_key("cookie"));
        assert!(!fwd.contains_key("x-traefik-route"));
        assert_eq!(
            fwd.get("content-type").and_then(|v| v.to_str().ok()),
            Some("application/json"),
        );
    }
}
