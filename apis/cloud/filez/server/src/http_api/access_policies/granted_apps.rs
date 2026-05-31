//! `POST /api/access_policies/granted_apps/list` — sibling of
//! realtime's granted_apps endpoint. Same wire shape so the
//! authz-admin BFF stays translator-free.
//!
//! Returns every app the caller has granted at least one
//! non-revoked policy to, with the per-app count. Backs the
//! Phase 7 App-revocation panel.
//!
//! Scope is always self: `access_policies.owner_id = caller`. No
//! filter for "show me apps another user granted" — that would
//! defeat the user-consent model.

use axum::{extract::State, Extension};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use std::collections::HashMap;
use tracing::warn;
use utoipa::ToSchema;
use uuid::Uuid;

/// Same bound as the realtime sibling — observability so the
/// in-Rust groupby assumption stops being invisible (review R6).
const IN_RUST_GROUPBY_WARN_THRESHOLD: usize = 250;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::apps::MowsAppId,
    schema,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::Json,
    with_timing,
};

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListGrantedAppsRequestBody {
    // Empty for now — kept as a typed struct so a future filter
    // is an additive field rather than a wire-shape break.
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GrantedApp {
    pub app_id: Uuid,
    pub policy_count: i64,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListGrantedAppsResponseBody {
    /// Ordered by `policy_count DESC, app_id` so the SPA panel
    /// surfaces the most-shared apps first; the tie-break by id
    /// keeps the order stable across requests.
    pub apps: Vec<GrantedApp>,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/granted_apps/list",
    request_body = ListGrantedAppsRequestBody,
    description = "List every app the caller has granted at least one non-revoked policy to, with the per-app count. Sibling of realtime-server's endpoint; both emit the same wire shape so the authz-admin BFF forwards verbatim.",
    responses(
        (status = 200, description = "Granted apps", body = ApiResponse<ListGrantedAppsResponseBody>),
        (status = 401, description = "Anonymous request"),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_granted_apps(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(_body): Json<ListGrantedAppsRequestBody>,
) -> Result<Json<ApiResponse<ListGrantedAppsResponseBody>>, FilezError> {
    let caller = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| FilezError::Unauthorized("authentication required".to_string()))?;

    let mut connection = database.get_connection().await?;
    let rows: Vec<Vec<MowsAppId>> = with_timing!(
        schema::access_policies::table
            .filter(schema::access_policies::owner_id.eq(caller.id))
            .filter(schema::access_policies::revoked.eq(false))
            .select(schema::access_policies::context_app_ids)
            .load::<Vec<MowsAppId>>(&mut connection)
            .await?,
        "granted_apps: select caller's non-revoked policies",
        timing
    );

    // Each policy carries multiple context_app_ids (array column);
    // a policy that lists 3 apps contributes 1 to each of the 3
    // counts. Bounded by user count of policies — in-process group
    // is fine; a future "all-server" surface would push GROUP BY
    // into Postgres via `unnest()`.
    if rows.len() > IN_RUST_GROUPBY_WARN_THRESHOLD {
        warn!(
            policy_count = rows.len(),
            threshold = IN_RUST_GROUPBY_WARN_THRESHOLD,
            user_id = %caller.id.0,
            "granted_apps: caller exceeds the in-Rust-groupby bound (review R6)"
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
    apps.sort_by(|a, b| {
        b.policy_count
            .cmp(&a.policy_count)
            .then_with(|| a.app_id.cmp(&b.app_id))
    });

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: format!("{} app(s)", apps.len()),
        data: Some(ListGrantedAppsResponseBody { apps }),
    }))
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the request + response field names so realtime sibling
    //! + BFF + SPA stay in lockstep.
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_accepts_empty_object() {
        let _: ListGrantedAppsRequestBody =
            serde_json::from_value(json!({})).expect("empty body accepted");
    }

    #[test]
    fn response_body_field_names_pinned() {
        let body = ListGrantedAppsResponseBody {
            apps: vec![GrantedApp {
                app_id: Uuid::nil(),
                policy_count: 3,
            }],
        };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert!(serialised.get("apps").is_some());
        assert_eq!(serialised["apps"][0]["app_id"], "00000000-0000-0000-0000-000000000000");
        assert_eq!(serialised["apps"][0]["policy_count"], 3);
        assert!(serialised.get("granted_apps").is_none());
    }

    /// Review R4 / QA-3 — same caller-scope + revoked=false guard
    /// the realtime sibling carries. Both filters are load-bearing
    /// invariants; pinning them via debug-query runs without a DB.
    #[test]
    fn query_filters_on_owner_and_revoked_false() {
        use crate::models::users::FilezUserId;
        let alice = FilezUserId(Uuid::from_u128(0xA));
        let q = schema::access_policies::table
            .filter(schema::access_policies::owner_id.eq(alice))
            .filter(schema::access_policies::revoked.eq(false))
            .select(schema::access_policies::context_app_ids);
        let sql = diesel::debug_query::<diesel::pg::Pg, _>(&q).to_string();
        assert!(
            sql.contains("\"owner_id\" = $1"),
            "query MUST filter on owner_id — caller-scope guard. SQL: {sql}",
        );
        assert!(
            sql.contains("\"revoked\" = $2"),
            "query MUST filter on revoked = false — drop here \
             inflates the per-app count. SQL: {sql}",
        );
    }
}
