//! `POST /api/access_policies/granted_apps/list` — every app the
//! caller has granted at least one (non-revoked) policy to,
//! grouped by app id with a per-app policy count.
//!
//! Backs the Phase 7 admin UI's "App revocation" panel — the user
//! sees the list, picks an app, the SPA then calls
//! /revoke_by_app to flip them all to `revoked = true` in one
//! UPDATE (APP_AUTHORIZATION.md §7).
//!
//! Scope is always self: caller's own `access_policies.owner_id`
//! rows only. No filter param exists for "show me apps a *different*
//! user granted" — that would defeat the user-consent model.
//!
//! Implementation note: groups in Rust rather than SQL. The
//! `context_app_ids` column is an array; the canonical SQL
//! grouping is `unnest()` + `GROUP BY`, which diesel's DSL
//! doesn't express cleanly. The expected bound is ~100 policies
//! across ~20 apps per user — typical caller has far fewer.
//! `IN_RUST_GROUPBY_WARN_THRESHOLD` (below) makes a breach
//! observable via tracing::warn so the assumption stops being
//! invisible. A future "all-server-policies" aggregate surface
//! would need the GROUP BY pushed into Postgres.

use axum::{extract::State, Extension, Json};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::warn;
use utoipa::ToSchema;
use uuid::Uuid;

/// If a caller's policy count crosses this threshold the
/// in-Rust group is still correct, but the per-request CPU + alloc
/// load starts mattering. tracing::warn so the assumption
/// becomes observable instead of invisible (review R6 / SLOP-7).
const IN_RUST_GROUPBY_WARN_THRESHOLD: usize = 250;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::apps::MowsAppId,
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListGrantedAppsRequest {
    // No fields — kept as a typed struct so a future filter
    // (e.g. include_revoked) lands as an additive field rather
    // than a wire-shape break.
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct GrantedApp {
    pub app_id: Uuid,
    /// Count of non-revoked policies the caller has granted to
    /// this app. Always >= 1 (zero-count apps wouldn't appear in
    /// the list).
    pub policy_count: i64,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListGrantedAppsResponse {
    /// Ordered by `policy_count DESC, app_id` so the panel
    /// surfaces the most-shared apps first; tie-break by id keeps
    /// the order stable across requests for snapshot diffing.
    pub apps: Vec<GrantedApp>,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/granted_apps/list",
    request_body = ListGrantedAppsRequest,
    description = "List every app the caller has granted at least one non-revoked policy to, with the per-app count. Backs the Phase 7 admin UI's App-revocation panel.",
    responses(
        (status = 200, description = "Granted apps", body = ApiResponse<ListGrantedAppsResponse>),
        (status = 401, description = "Anonymous request"),
    )
)]
pub async fn list_granted_apps(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(_body): Json<ListGrantedAppsRequest>,
) -> Result<Json<ApiResponse<ListGrantedAppsResponse>>, RealtimeError> {
    let caller = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    let mut connection = state.database.get_connection().await?;
    let rows: Vec<Vec<MowsAppId>> = schema::access_policies::table
        .filter(schema::access_policies::owner_id.eq(caller.id))
        .filter(schema::access_policies::revoked.eq(false))
        .select(schema::access_policies::context_app_ids)
        .load::<Vec<MowsAppId>>(&mut connection)
        .await?;

    // Group across rows: each policy may carry multiple
    // context_app_ids (the array column), so we count distinct
    // (policy, app) pairs by walking each row's array. A policy
    // that lists 3 apps contributes 1 to each of the 3 counts.
    if rows.len() > IN_RUST_GROUPBY_WARN_THRESHOLD {
        warn!(
            policy_count = rows.len(),
            threshold = IN_RUST_GROUPBY_WARN_THRESHOLD,
            user_id = %caller.id.0,
            "granted_apps: caller exceeds the in-Rust-groupby bound; \
             a future SQL GROUP BY is warranted if this is sustained"
        );
    }
    let mut counts: HashMap<Uuid, i64> = HashMap::new();
    for row in rows {
        for app_id in row {
            *counts.entry(app_id.0).or_insert(0) += 1;
        }
    }

    let mut apps: Vec<GrantedApp> = counts
        .into_iter()
        .map(|(app_id, policy_count)| GrantedApp { app_id, policy_count })
        .collect();
    // Sort: most-policies first, tie-break by id for stability.
    apps.sort_by(|a, b| {
        b.policy_count
            .cmp(&a.policy_count)
            .then_with(|| a.app_id.cmp(&b.app_id))
    });

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} app(s)", apps.len()),
        data: Some(ListGrantedAppsResponse { apps }),
    }))
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the request + response field names. The authz-admin
    //! BFF forwards bytes verbatim and the filez sibling endpoint
    //! must use the same shape; a rename here breaks both sides
    //! silently (empty SPA panel).
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_accepts_empty_object() {
        let _: ListGrantedAppsRequest =
            serde_json::from_value(json!({})).expect("empty body accepted");
    }

    #[test]
    fn response_body_field_names_pinned() {
        let body = ListGrantedAppsResponse {
            apps: vec![GrantedApp {
                app_id: Uuid::nil(),
                policy_count: 3,
            }],
        };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert!(serialised.get("apps").is_some());
        assert_eq!(serialised["apps"][0]["app_id"], "00000000-0000-0000-0000-000000000000");
        assert_eq!(serialised["apps"][0]["policy_count"], 3);
        // Pin the absence of likely-drift names so a refactor
        // surfaces here.
        assert!(serialised.get("granted_apps").is_none());
        assert!(serialised["apps"][0].get("count").is_none());
    }

    /// Review R4 / QA-3 — pin that the SQL contains
    /// `revoked = $bind` *and* the caller-scope filter.
    /// A regression that dropped either silently lets the count
    /// include already-revoked rows OR another user's rows. The
    /// debug-query test runs without a DB.
    #[test]
    fn query_filters_on_owner_and_revoked_false() {
        use crate::models::users::UserId;
        let alice = UserId(Uuid::from_u128(0xA));
        let q = schema::access_policies::table
            .filter(schema::access_policies::owner_id.eq(alice))
            .filter(schema::access_policies::revoked.eq(false))
            .select(schema::access_policies::context_app_ids);
        let sql = diesel::debug_query::<diesel::pg::Pg, _>(&q).to_string();
        assert!(
            sql.contains("\"owner_id\" = $1"),
            "query MUST filter on owner_id — caller-scope is the only \
             reason the granted_apps response is safe to return. SQL: {sql}",
        );
        assert!(
            sql.contains("\"revoked\" = $2"),
            "query MUST filter on revoked = false — a drop here would \
             let the per-app count include already-revoked rows. SQL: {sql}",
        );
    }
}
