//! BFF forwarders for the Phase 7 App-revocation panel — wraps
//! the two upstream endpoints behind the same translator-free
//! single-upstream pattern explain / by_resource / audit_log
//! already use:
//!
//!   * `POST /api/access_policies/granted_apps/list` — list every
//!     app the caller has granted at least one policy to.
//!   * `POST /api/access_policies/revoke_by_app` — bulk-revoke
//!     every non-revoked policy the caller has granted to one
//!     app.
//!
//! Both reuse the shared http_api::forwarder helpers — same
//! identity guard, same whitelisted header passthrough, same body
//! size cap — so a future identity-header change lands in one
//! place across all five forwarders.

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

// ---- granted_apps -----------------------------------------------

#[derive(Deserialize, ToSchema, Debug)]
pub struct GrantedAppsRequest {
    /// Upstream key from `/api/upstreams` (`"realtime"` / `"filez"`).
    pub upstream: String,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct GrantedAppsResponse {
    pub upstream: String,
    pub upstream_status: u16,
    /// Verbatim JSON from the upstream — shape:
    /// `{status, message, data: {apps: [{app_id, policy_count}]}}`
    /// on 200.
    pub upstream_body: JsonValue,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/granted_apps/list",
    request_body = GrantedAppsRequest,
    description = "Forward a granted-apps query to one upstream consumer. The frontend fans out per upstream tab.",
    responses(
        (status = 200, body = ApiResponse<GrantedAppsResponse>),
        (status = 400, description = "Unknown upstream / oversize body / missing-field request"),
        (status = 401, description = "Missing identity header"),
        (status = 502, description = "Upstream request failed"),
    )
)]
pub async fn forward_granted_apps(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<GrantedAppsResponse>>, AuthzAdminError> {
    let (parts, body) = request.into_parts();
    let bytes = read_bounded_body(body).await?;
    let req: GrantedAppsRequest = serde_json::from_slice(&bytes)
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

    require_identity_header(&parts.headers)?;
    let fwd_headers = build_forwarding_headers(&parts.headers);

    // The upstream's body shape is `{}` today — the only inbound
    // field the BFF accepts (`upstream`) routes the request and
    // is never forwarded. Sending `{}` is correct.
    //
    // WARNING (review R7 / TECH-5 / SLOP-3): if a future PR adds
    // a filter field to the upstream's ListGrantedAppsRequest
    // (e.g. `include_revoked: bool`), this hardcoded `{}` will
    // silently drop it. Whoever extends the upstream MUST also
    // extend `GrantedAppsRequest` here AND replace this `{}`
    // with a structured forward — there's no auto-passthrough.
    let resp = state
        .http
        .post(format!(
            "{}/api/access_policies/granted_apps/list",
            upstream.base_url
        ))
        .headers(fwd_headers)
        .json(&serde_json::json!({}))
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
        data: Some(GrantedAppsResponse {
            upstream: upstream.key.to_string(),
            upstream_status,
            upstream_body: upstream_json,
        }),
    }))
}

// ---- revoke_by_app ----------------------------------------------

#[derive(Deserialize, ToSchema, Debug)]
pub struct RevokeByAppRequest {
    pub upstream: String,
    /// Typed as Uuid at the BFF deserializer — same R9 / SEC-5
    /// stance as the other forwarders: malformed input becomes a
    /// clean 400 from the BFF, never reaches the upstream.
    pub context_app_id: Uuid,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct RevokeByAppResponse {
    pub upstream: String,
    pub upstream_status: u16,
    pub upstream_body: JsonValue,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/revoke_by_app",
    request_body = RevokeByAppRequest,
    description = "Forward a bulk-revoke-by-app to one upstream consumer.",
    responses(
        (status = 200, body = ApiResponse<RevokeByAppResponse>),
        (status = 400, description = "Unknown upstream / invalid uuid / oversize body"),
        (status = 401, description = "Missing identity header"),
        (status = 502, description = "Upstream request failed"),
    )
)]
pub async fn forward_revoke_by_app(
    State(state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<RevokeByAppResponse>>, AuthzAdminError> {
    let (parts, body) = request.into_parts();
    let bytes = read_bounded_body(body).await?;
    let req: RevokeByAppRequest = serde_json::from_slice(&bytes)
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

    require_identity_header(&parts.headers)?;
    let fwd_headers = build_forwarding_headers(&parts.headers);

    let resp = state
        .http
        .post(format!(
            "{}/api/access_policies/revoke_by_app",
            upstream.base_url
        ))
        .headers(fwd_headers)
        .json(&serde_json::json!({
            "context_app_id": req.context_app_id.to_string(),
        }))
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
        data: Some(RevokeByAppResponse {
            upstream: upstream.key.to_string(),
            upstream_status,
            upstream_body: upstream_json,
        }),
    }))
}
