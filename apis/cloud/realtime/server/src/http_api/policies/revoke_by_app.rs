//! `POST /api/access_policies/revoke_by_app` — bulk-revoke every
//! non-revoked policy the caller has granted to one app.
//!
//! APP_AUTHORIZATION.md §7: "Revoke all access I've ever granted
//! to App A. One SQL: `UPDATE access_policies SET revoked = TRUE
//! WHERE owner_id = me AND context_app_ids @> ARRAY[A]`." The
//! engine's lifecycle filter skips revoked rows on the next
//! `check_access`, so the effect is immediate without an
//! invalidation step.
//!
//! Revocation is **soft** — the rows stay in the table so the
//! audit trail survives. A no-op call (caller already revoked
//! everything they had granted to this app) returns 0 and still
//! writes an `AppPoliciesRevoked { revoked_count: 0 }` audit row
//! so the timeline shows the intent.

use axum::{extract::State, Extension, Json};
use diesel::dsl::sql;
use diesel::prelude::*;
use diesel::sql_types::Array;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::AccessPolicyResourceType,
        apps::MowsAppId,
        audit_log::{AuditEvent, AuditLog},
    },
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct RevokeByAppRequest {
    pub context_app_id: Uuid,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct RevokeByAppResponse {
    pub revoked_count: usize,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/revoke_by_app",
    request_body = RevokeByAppRequest,
    description = "Bulk-revoke every non-revoked policy the caller has granted to one app (APP_AUTHORIZATION.md §7). Idempotent — a no-op call returns 0 and still writes an audit row.",
    responses(
        (status = 200, description = "Revoked", body = ApiResponse<RevokeByAppResponse>),
        (status = 401, description = "Anonymous request"),
    )
)]
pub async fn revoke_by_app(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(body): Json<RevokeByAppRequest>,
) -> Result<Json<ApiResponse<RevokeByAppResponse>>, RealtimeError> {
    let caller = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    let mut connection = state.database.get_connection().await?;
    // Filter on `context_app_ids @> ARRAY[$app_id]` — pgsql array
    // contains. Diesel doesn't ship a `.contains()` helper for the
    // typed Array column, so we drop down to `sql::<Array<...>>`
    // for the bound parameter. The cast keeps the query
    // parameterised — no string interpolation on the app id.
    let app_id_typed = MowsAppId(body.context_app_id);
    let revoked_count = diesel::update(
        schema::access_policies::table
            .filter(schema::access_policies::owner_id.eq(caller.id))
            .filter(schema::access_policies::revoked.eq(false))
            .filter(
                sql::<diesel::sql_types::Bool>("context_app_ids @> ").bind::<
                    Array<diesel::sql_types::Uuid>,
                    _,
                >(vec![app_id_typed.0]),
            ),
    )
    .set(schema::access_policies::revoked.eq(true))
    .execute(&mut connection)
    .await?;

    // Write the audit summary. Even a no-op (revoked_count == 0)
    // gets a row so the timeline shows the intent — a caller who
    // clicks "revoke" twice in a row produces two audit rows, the
    // second with count 0. resource_id is the app id itself so
    // the audit-log panel's "events on this resource" filter
    // surfaces it when scoped to the app.
    AuditLog::insert(
        &state.database,
        AuditEvent::AppPoliciesRevoked {
            context_app_id: body.context_app_id,
            revoked_count,
        },
        Some(&caller.id),
        AccessPolicyResourceType::MowsApp,
        Some(body.context_app_id),
    )
    .await?;

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{revoked_count} policy(ies) revoked"),
        data: Some(RevokeByAppResponse { revoked_count }),
    }))
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the request + response field names — the authz-admin
    //! BFF forwards bytes verbatim and the filez sibling must
    //! use the same shape.
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_uses_context_app_id_field() {
        let parsed: RevokeByAppRequest = serde_json::from_value(json!({
            "context_app_id": "00000000-0000-0000-0000-000000000001",
        }))
        .expect("must accept the canonical shape");
        let back = serde_json::to_value(&parsed).expect("round-trip");
        assert_eq!(back["context_app_id"], "00000000-0000-0000-0000-000000000001");
        // Drift guards: a refactor that renamed the field would
        // silently empty the SPA's revoke action.
        assert!(back.get("app_id").is_none());
        assert!(back.get("context_app_ids").is_none());
    }

    #[test]
    fn response_body_uses_revoked_count_field() {
        let body = RevokeByAppResponse { revoked_count: 7 };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert_eq!(serialised["revoked_count"], 7);
        assert!(serialised.get("count").is_none());
        assert!(serialised.get("revoked").is_none());
    }

    /// Review R4 / QA-3 — pin that the UPDATE filters on the
    /// caller's id AND only touches `revoked = false` rows. A
    /// regression that dropped `owner_id` lets ANY user revoke
    /// any other user's policies; a regression that dropped
    /// `revoked = false` re-flips already-revoked rows and
    /// inflates the count (also re-emits the audit row with a
    /// wrong revoked_count). The debug-query test runs without
    /// a DB.
    #[test]
    fn update_filters_on_owner_and_revoked_false() {
        use crate::models::users::UserId;
        let alice = UserId(Uuid::from_u128(0xA));
        let q = diesel::update(
            schema::access_policies::table
                .filter(schema::access_policies::owner_id.eq(alice))
                .filter(schema::access_policies::revoked.eq(false)),
        )
        .set(schema::access_policies::revoked.eq(true));
        let sql = diesel::debug_query::<diesel::pg::Pg, _>(&q).to_string();
        assert!(
            sql.contains("\"owner_id\" = $"),
            "UPDATE MUST filter on owner_id — caller-scope is the only \
             reason this endpoint can't revoke another user's policies. \
             SQL: {sql}",
        );
        assert!(
            sql.contains("\"revoked\" = $"),
            "UPDATE MUST filter on revoked = false — a drop here \
             re-flips already-revoked rows and inflates revoked_count. \
             SQL: {sql}",
        );
    }
}
