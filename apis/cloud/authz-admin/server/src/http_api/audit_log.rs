//! `POST /api/audit_log/list` — forwards an audit-log query to one
//! upstream and returns its response verbatim.
//!
//! Sibling of [`super::explain`] and [`super::by_resource`]. Same
//! single-upstream stance: the frontend drives concurrency by
//! calling this once per upstream tab. After the realtime + filez
//! audit_log endpoints agreed on the wire shape (`{resource_type,
//! resource_id, limit, cursor}` request / `{entries, next_cursor}`
//! response), the BFF forwards the body verbatim — no per-upstream
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
pub struct AuditLogRequest {
    /// Which upstream to forward to. Must match a `key` from
    /// `/api/upstreams` (`"realtime"`, `"filez"`).
    pub upstream: String,
    /// Optional resource type — when present alongside
    /// `resource_id`, the response is scoped to events on that
    /// resource (owner-only). When absent, the upstream returns
    /// the caller's own actions.
    #[serde(default)]
    pub resource_type: Option<String>,
    /// Optional resource id. Typed as Uuid at the BFF so a malformed
    /// input is a clean 400 from the BFF instead of a 500/parse
    /// error from the upstream.
    #[serde(default)]
    pub resource_id: Option<Uuid>,
    /// Page size. Forwarded verbatim — upstream clamps.
    #[serde(default)]
    pub limit: Option<i64>,
    /// Opaque cursor from the prior page's `next_cursor`.
    /// Forwarded verbatim; upstream rejects malformed values with
    /// a clean 400.
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct AuditLogResponse {
    pub upstream: String,
    /// HTTP status the upstream returned. Surfaced so the frontend
    /// can distinguish 200 (page) / 403 (no such resource OR not
    /// yours) / 401 (no identity) without re-parsing the upstream
    /// envelope.
    pub upstream_status: u16,
    /// Verbatim JSON the upstream returned. Shape:
    /// `{status, message, data: {entries: [...], next_cursor?}}`
    /// for 200; the upstream's error envelope otherwise.
    pub upstream_body: JsonValue,
}

#[utoipa::path(
    post,
    path = "/api/audit_log/list",
    request_body = AuditLogRequest,
    description = "Forward an audit-log query to a single upstream consumer and return its response verbatim. Frontend fans out by calling this once per upstream tab.",
    responses(
        (status = 200, body = ApiResponse<AuditLogResponse>),
        (status = 400, description = "Unknown upstream / oversize body / missing-field request"),
        (status = 401, description = "Missing identity header (Authorization or x-realtime-user-id or x-filez-user-id)"),
        (status = 502, description = "Upstream request failed"),
    )
)]
pub async fn forward_audit_log(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<AuditLogResponse>>, AuthzAdminError> {
    let (parts, body) = request.into_parts();
    let bytes = read_bounded_body(body).await?;
    let req: AuditLogRequest = serde_json::from_slice(&bytes)
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
    // passthrough. See `http_api::forwarder` for the rationale.
    require_identity_header(&parts.headers)?;
    let fwd_headers = build_forwarding_headers(&parts.headers);

    // Hand the body through with the upstream's expected shape.
    // The BFF doesn't second-guess the caller's filters — the
    // upstream enforces the (resource_type, resource_id) coupling
    // (both must be present together) and the owner gate.
    let mut upstream_body = serde_json::Map::new();
    if let Some(rt) = req.resource_type.as_ref() {
        upstream_body.insert(
            "resource_type".to_string(),
            JsonValue::String(rt.clone()),
        );
    }
    if let Some(rid) = req.resource_id {
        upstream_body.insert("resource_id".to_string(), JsonValue::String(rid.to_string()));
    }
    if let Some(limit) = req.limit {
        upstream_body.insert("limit".to_string(), JsonValue::from(limit));
    }
    if let Some(cursor) = req.cursor.as_ref() {
        upstream_body.insert(
            "cursor".to_string(),
            JsonValue::String(cursor.clone()),
        );
    }

    let resp = state
        .http
        .post(format!("{}/api/audit_log/list", upstream.base_url))
        .headers(fwd_headers)
        .json(&JsonValue::Object(upstream_body))
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
        data: Some(AuditLogResponse {
            upstream: upstream.key.to_string(),
            upstream_status,
            upstream_body: upstream_json,
        }),
    }))
}
