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

use axum::extract::{Request, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use utoipa::ToSchema;

use crate::errors::AuthzAdminError;
use crate::http_api::forwarder::{
    build_forwarding_headers, read_bounded_body, require_identity_header,
};
use crate::state::AppState;
use crate::types::{ApiResponse, ApiResponseStatus};

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
    /// Verbatim JSON the upstream returned. After review-1 R4
    /// both realtime + filez emit `{ data: { evaluations: [...] } }`
    /// in the response, so the frontend just walks the envelope.
    /// A stale upstream that still uses the old `auth_evaluations`
    /// name will surface as the SPA's empty-state placeholder —
    /// the wire_shape_guard unit tests in each upstream pin the
    /// canonical name to catch drift before deploy.
    pub upstream_body: JsonValue,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/explain",
    request_body = ExplainRequest,
    description = "Forward an explain query to a single upstream consumer and return its response verbatim. Frontend fans out by calling this once per upstream in parallel.",
    responses(
        (status = 200, body = ApiResponse<ExplainResponse>),
        (status = 400, description = "Unknown upstream / oversize body / missing-field request"),
        (status = 401, description = "Missing identity header (Authorization or x-realtime-user-id or x-filez-user-id)"),
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
    let bytes = read_bounded_body(body).await?;
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

    // SEC-2 / review-1 R2 — refuse anonymous; build the whitelisted
    // header passthrough. See `http_api::forwarder` for the
    // rationale. Identical guard sits in front of by_resource.
    require_identity_header(&parts.headers)?;
    let fwd_headers = build_forwarding_headers(&parts.headers);

    // After review-3 R4 both upstream explain endpoints agree on
    // the wire shape (`{resource_type, action}` request,
    // `{evaluations}` response). The BFF hands the body through
    // verbatim — no per-upstream `match` adapter, no SPA-side
    // `unwrapEvaluations` workaround. A third consumer is
    // expected to publish the same shape; if it doesn't, the
    // proper fix is to align it, not re-grow a BFF translator.
    let upstream_body = serde_json::json!({
        "resource_type": req.resource_type,
        "action": req.action,
    });

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
