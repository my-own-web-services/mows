//! `POST /api/access_policies/by_resource` — forwards an inverse
//! "who can see X?" query to one upstream and returns its response
//! verbatim.
//!
//! Sibling of [`super::explain`]. Same single-upstream stance: the
//! frontend drives concurrency by calling this once per upstream
//! tab, because each upstream's `(resource_type, resource_id)`
//! vocabulary differs (realtime → Channel/User/…; filez →
//! File/FileGroup/…). The BFF stays stateless.
//!
//! Auth headers + body validation are shared with the explain
//! forwarder via [`super::forwarder`]. After review-1 R4 both
//! upstreams use the same `{resource_type, resource_id}` request
//! shape and the same `{resource_owner_id, policies}` response
//! shape, so the BFF forwards the body verbatim — no per-upstream
//! adapter, no SPA-side translator.

use axum::extract::{Request, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::errors::AuthzAdminError;
use crate::http_api::forwarder::{
    build_forwarding_headers, read_bounded_body, require_identity_header,
};
use crate::state::AppState;
use crate::types::{ApiResponse, ApiResponseStatus};

#[derive(Deserialize, ToSchema, Debug)]
pub struct ByResourceRequest {
    /// Which upstream to forward to. Must match a `key` from
    /// `/api/upstreams` (`"realtime"`, `"filez"`).
    pub upstream: String,
    /// Upstream-specific resource type identifier — passed through
    /// to the upstream's `/api/access_policies/by_resource`
    /// verbatim. Realtime accepts `"Channel"` etc., filez accepts
    /// `"File"` / `"FileGroup"`.
    pub resource_type: String,
    /// The id of the resource to inspect. Deserialized as a `Uuid`
    /// so an invalid input (e.g. "not-a-uuid") becomes a clean BFF
    /// 400 with a typed message instead of a 500 from the upstream's
    /// parse error. Review R9.
    pub resource_id: Uuid,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct ByResourceResponse {
    pub upstream: String,
    /// HTTP status the upstream returned. Surfaced so the frontend
    /// can distinguish 200 (owner sees policies) / 403 (not the
    /// owner, or no such resource — deliberately collapsed by the
    /// upstreams) / 401 (no identity) without re-parsing the
    /// upstream envelope.
    pub upstream_status: u16,
    /// Verbatim JSON the upstream returned. Shape:
    /// `{status, message, data: {resource_owner_id, policies}}`
    /// for 200; the upstream's error envelope otherwise.
    pub upstream_body: JsonValue,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/by_resource",
    request_body = ByResourceRequest,
    description = "Forward a 'who can see X?' query to a single upstream consumer and return its response verbatim. Frontend fans out by calling this once per upstream tab in parallel.",
    responses(
        (status = 200, body = ApiResponse<ByResourceResponse>),
        (status = 400, description = "Unknown upstream / oversize body / missing-field request"),
        (status = 401, description = "Missing identity header (Authorization or x-realtime-user-id or x-filez-user-id)"),
        (status = 502, description = "Upstream request failed"),
    )
)]
pub async fn forward_by_resource(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<ByResourceResponse>>, AuthzAdminError> {
    let (parts, body) = request.into_parts();
    let bytes = read_bounded_body(body).await?;
    let req: ByResourceRequest = serde_json::from_slice(&bytes)
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

    // SEC-2 / review-1 R2 — refuse anonymous; whitelisted header
    // passthrough. See `http_api::forwarder` for the rationale
    // (review R11).
    require_identity_header(&parts.headers)?;
    let fwd_headers = build_forwarding_headers(&parts.headers);

    let upstream_body = serde_json::json!({
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
    });

    let resp = state
        .http
        .post(format!(
            "{}/api/access_policies/by_resource",
            upstream.base_url
        ))
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
        data: Some(ByResourceResponse {
            upstream: upstream.key.to_string(),
            upstream_status,
            upstream_body: upstream_json,
        }),
    }))
}
