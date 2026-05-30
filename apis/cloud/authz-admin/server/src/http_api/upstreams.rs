//! `GET /api/upstreams` — list the consumer services this BFF
//! aggregates.
//!
//! The frontend reads this once on boot to know which tabs /
//! per-consumer sections to render. Each upstream entry carries
//! its stable key (`"realtime"` / `"filez"`) plus a reachability
//! probe so an operator can immediately see "I configured filez
//! but the service is down".

use axum::extract::State;
use axum::Json;
use futures::future::join_all;
use serde::Serialize;
use utoipa::ToSchema;

use crate::state::AppState;
use crate::types::{ApiResponse, ApiResponseStatus};

#[derive(Serialize, ToSchema, Debug)]
pub struct UpstreamStatus {
    pub key: String,
    pub base_url: String,
    /// Whether the upstream answered its `/api/health` with 200
    /// at the moment of the probe. The probe is fired in parallel
    /// per upstream; total response time is bounded by the
    /// slowest upstream (or its timeout — 10 s, set in
    /// `AppState::new`).
    pub reachable: bool,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct UpstreamsResponse {
    pub upstreams: Vec<UpstreamStatus>,
}

#[utoipa::path(
    get,
    path = "/api/upstreams",
    description = "List configured upstreams with a live reachability probe. The first thing the admin UI calls; drives which per-consumer panels render.",
    responses((status = 200, body = ApiResponse<UpstreamsResponse>))
)]
pub async fn list_upstreams(
    State(state): State<AppState>,
) -> Json<ApiResponse<UpstreamsResponse>> {
    let probes = state.upstreams.upstreams.iter().map(|up| {
        let http = state.http.clone();
        let key = up.key;
        let base = up.base_url.clone();
        async move {
            let reachable = http
                .get(format!("{base}/api/health"))
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            UpstreamStatus {
                key: key.to_string(),
                base_url: base,
                reachable,
            }
        }
    });
    let upstreams: Vec<UpstreamStatus> = join_all(probes).await;
    let total = upstreams.len();
    Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{total} upstream(s) configured"),
        data: Some(UpstreamsResponse { upstreams }),
    })
}
