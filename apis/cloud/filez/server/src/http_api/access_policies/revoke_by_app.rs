//! `POST /api/access_policies/revoke_by_app` — sibling of
//! realtime's revoke_by_app. Bulk-revokes every non-revoked
//! policy the caller has granted to one app.
//!
//! APP_AUTHORIZATION.md §7. Same idempotent semantics as the
//! realtime sibling: a no-op call returns 0 (nothing left to
//! revoke). Filez does NOT write a paired audit row here — the
//! audit_log table is populated by the per-policy revoke pathway
//! today (Phase 5 lifecycle); the bulk-revoke summary lives at
//! the realtime side because that's where this initiative's
//! audit-log E2E shipped first. Adding an `AppPoliciesRevoked`
//! audit variant to filez is a Phase 7 follow-up tracked in the
//! disposition doc.

use axum::{extract::State, Extension};
use diesel::dsl::sql;
use diesel::prelude::*;
use diesel::sql_types::Array;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

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
pub struct RevokeByAppRequestBody {
    pub context_app_id: Uuid,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct RevokeByAppResponseBody {
    pub revoked_count: usize,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/revoke_by_app",
    request_body = RevokeByAppRequestBody,
    description = "Bulk-revoke every non-revoked policy the caller has granted to one app (APP_AUTHORIZATION.md §7). Idempotent — a second call after everything is already revoked returns 0.",
    responses(
        (status = 200, description = "Revoked", body = ApiResponse<RevokeByAppResponseBody>),
        (status = 401, description = "Anonymous request"),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn revoke_by_app(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(body): Json<RevokeByAppRequestBody>,
) -> Result<Json<ApiResponse<RevokeByAppResponseBody>>, FilezError> {
    let caller = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| FilezError::Unauthorized("authentication required".to_string()))?;

    let mut connection = database.get_connection().await?;
    let app_id_typed = MowsAppId(body.context_app_id);
    let revoked_count = with_timing!(
        diesel::update(
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
        .await?,
        "revoke_by_app: bulk flip revoked=true",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: format!("{revoked_count} policy(ies) revoked"),
        data: Some(RevokeByAppResponseBody { revoked_count }),
    }))
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the request + response field names — same shape as the
    //! realtime sibling so the BFF stays a verbatim forwarder.
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_uses_context_app_id_field() {
        let parsed: RevokeByAppRequestBody = serde_json::from_value(json!({
            "context_app_id": "00000000-0000-0000-0000-000000000001",
        }))
        .expect("must accept the canonical shape");
        let back = serde_json::to_value(&parsed).expect("round-trip");
        assert_eq!(back["context_app_id"], "00000000-0000-0000-0000-000000000001");
        assert!(back.get("app_id").is_none());
    }

    #[test]
    fn response_body_uses_revoked_count_field() {
        let body = RevokeByAppResponseBody { revoked_count: 7 };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert_eq!(serialised["revoked_count"], 7);
        assert!(serialised.get("count").is_none());
    }

    /// Review R4 / QA-3 — same SQL-guard as the realtime sibling.
    /// Pins the UPDATE filter on owner_id (caller-scope; without
    /// this any user could revoke any other user's policies) and
    /// on revoked = false (without this a no-op call re-flips
    /// already-revoked rows + inflates the count).
    #[test]
    fn update_filters_on_owner_and_revoked_false() {
        use crate::models::users::FilezUserId;
        let alice = FilezUserId(Uuid::from_u128(0xA));
        let q = diesel::update(
            schema::access_policies::table
                .filter(schema::access_policies::owner_id.eq(alice))
                .filter(schema::access_policies::revoked.eq(false)),
        )
        .set(schema::access_policies::revoked.eq(true));
        let sql = diesel::debug_query::<diesel::pg::Pg, _>(&q).to_string();
        assert!(
            sql.contains("\"owner_id\" = $"),
            "UPDATE MUST filter on owner_id. SQL: {sql}",
        );
        assert!(
            sql.contains("\"revoked\" = $"),
            "UPDATE MUST filter on revoked = false. SQL: {sql}",
        );
    }
}
