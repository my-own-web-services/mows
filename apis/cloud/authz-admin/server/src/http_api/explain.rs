//! `POST /api/access_policies/explain` — forwards an explain
//! query to one upstream and returns its response verbatim.
//!
//! Single-upstream rather than auto-fanout because:
//!   * Each upstream has its own resource-type + action vocabulary
//!     (realtime → Channel/User/…; filez → File/FileGroup/…).
//!     A fanout shape would need a per-upstream `(resource_type,
//!     action)` parameter anyway.
//!   * The frontend already needs to render per-upstream sections;
//!     letting it drive concurrency keeps the BFF stateless.
//!
//! Auth is forwarded as-is. The dev `x-realtime-user-id` header
//! and any `Authorization` Bearer token reach the upstream
//! unchanged so the explain answer reflects the *caller's* view,
//! not the BFF's.

use axum::body::to_bytes;
use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use utoipa::ToSchema;

use crate::errors::AuthzAdminError;
use crate::state::AppState;
use crate::types::{ApiResponse, ApiResponseStatus};

/// Maximum body size we accept on the inbound side. The explain
/// payload is small (resource_type + action + upstream key); a
/// caller sending megabytes is misbehaving.
const MAX_BODY_BYTES: usize = 16 * 1024;

#[derive(Deserialize, ToSchema, Debug)]
pub struct ExplainRequest {
    /// Which upstream to forward to. Must match a `key` from
    /// `/api/upstreams` (`"realtime"`, `"filez"`).
    pub upstream: String,
    /// Upstream-specific resource type identifier — passed through
    /// to the upstream's `/api/access_policies/explain` verbatim.
    pub resource_type: String,
    /// Upstream-specific action identifier — passed through
    /// verbatim.
    pub action: String,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct ExplainResponse {
    pub upstream: String,
    /// HTTP status the upstream returned. The BFF surfaces it
    /// so the frontend can distinguish 200 / 403 / 5xx without
    /// re-parsing the upstream envelope.
    pub upstream_status: u16,
    /// Verbatim JSON the upstream returned. Shape varies by
    /// upstream (realtime returns `{evaluations}`, filez returns
    /// `{auth_evaluations}`); the frontend handles the per-key
    /// branch.
    pub upstream_body: JsonValue,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/explain",
    request_body = ExplainRequest,
    description = "Forward an explain query to a single upstream consumer and return its response verbatim. Frontend fans out by calling this once per upstream in parallel.",
    responses(
        (status = 200, body = ApiResponse<ExplainResponse>),
        (status = 400, description = "Unknown upstream / oversize body"),
        (status = 502, description = "Upstream request failed"),
    )
)]
pub async fn forward_explain(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<ExplainResponse>>, AuthzAdminError> {
    // axum's `Json` extractor doesn't expose the raw headers, so
    // we pull the body out manually and parse it ourselves; the
    // headers extractor wants the request before extraction.
    let (parts, body) = request.into_parts();
    let bytes = to_bytes(body, MAX_BODY_BYTES)
        .await
        .map_err(|e| AuthzAdminError::BadRequest(format!("body read: {e}")))?;
    let req: ExplainRequest = serde_json::from_slice(&bytes)
        .map_err(|e| AuthzAdminError::BadRequest(format!("body parse: {e}")))?;

    let upstream = state
        .upstreams
        .upstreams
        .iter()
        .find(|u| u.key == req.upstream)
        .ok_or_else(|| {
            AuthzAdminError::BadRequest(format!(
                "unknown upstream {:?} — see /api/upstreams",
                req.upstream
            ))
        })?;

    // Forward identity-bearing headers verbatim. Whitelist rather
    // than passthrough-all to avoid leaking BFF-internal headers
    // (e.g. routing cookies) into upstream services.
    let mut fwd_headers = HeaderMap::new();
    for name in [
        "authorization",
        "x-realtime-user-id",
        "x-filez-user-id",
    ] {
        if let Some(v) = parts.headers.get(name) {
            fwd_headers.insert(name, v.clone());
        }
    }
    fwd_headers.insert(
        "content-type",
        HeaderValue::from_static("application/json"),
    );

    // Upstream's own /api/access_policies/explain shape. The two
    // consumer endpoints already use field names that match
    // exactly what the operator would put in our `resource_type`
    // / `action` fields (case-sensitive), so we hand them through
    // by JSON re-shape rather than wrestling with typed enums
    // here — the BFF deliberately doesn't know each upstream's
    // vocabulary.
    let upstream_body = match req.upstream.as_str() {
        "realtime" => serde_json::json!({
            "resource_type": req.resource_type,
            "action": req.action,
        }),
        "filez" => serde_json::json!({
            "access_policy_resource_type": req.resource_type,
            "access_policy_action": req.action,
        }),
        other => {
            return Err(AuthzAdminError::BadRequest(format!(
                "no body adapter registered for upstream {other:?}"
            )));
        }
    };

    let resp = state
        .http
        .post(format!("{}/api/access_policies/explain", upstream.base_url))
        .headers(fwd_headers)
        .json(&upstream_body)
        .send()
        .await
        .map_err(|e| AuthzAdminError::Upstream(format!("{} send: {e}", upstream.key)))?;

    let upstream_status = resp.status().as_u16();
    let upstream_json: JsonValue = resp
        .json()
        .await
        .map_err(|e| AuthzAdminError::Upstream(format!("{} parse: {e}", upstream.key)))?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} replied {}", upstream.key, upstream_status),
        data: Some(ExplainResponse {
            upstream: upstream.key.to_string(),
            upstream_status,
            upstream_body: upstream_json,
        }),
    }))
}
