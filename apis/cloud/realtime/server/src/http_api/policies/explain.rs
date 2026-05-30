//! `POST /api/access_policies/explain` — per-resource "why am I
//! allowed / denied?" surface for an operator-facing diagnostic UI.
//!
//! Returns, for every resource of the given `resource_type` that
//! the caller has any policy on (Allow or Deny), the engine's
//! `AuthEvaluation` — including the `AuthReason` variant that
//! pinned the verdict (Owner / DirectUser / DirectUserGroup /
//! ServerMember / Public / Denied… / NoMatchingAllowPolicy /
//! ResourceNotFound).
//!
//! This is the prerequisite the cross-service authz admin UI
//! (`apis/cloud/authz-admin/`, Phase 7) will consume — but it
//! also stands alone as a curl-able diagnostic today. Sibling
//! filez endpoint will land next; the JSON shape stays identical
//! across consumers so the admin UI can fan out without a
//! per-service adapter layer.

use axum::{extract::State, Extension, Json};
use mows_auth_core::{AuthEvaluation, ResourceTypeRegistry};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::{
        check::{
            check_resources_access_control, engine_resource_registry,
            subject_from_realtime,
        },
        store::RealtimePolicyStore,
        AccessPolicyAction, AccessPolicyResourceType,
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Deserialize, ToSchema, Debug)]
pub struct ExplainRequest {
    pub resource_type: AccessPolicyResourceType,
    pub action: AccessPolicyAction,
}

#[derive(Serialize, ToSchema, Debug)]
pub struct ExplainResponse {
    /// One entry per resource the caller has any policy on
    /// (Allow OR Deny) for the requested `(resource_type, action)`
    /// pair. Resources the caller owns are included as
    /// `AuthReason::Owned` even when no explicit policy exists.
    pub evaluations: Vec<AuthEvaluation>,
}

#[utoipa::path(
    post,
    path = "/api/access_policies/explain",
    description = "Returns the AuthReason for every resource of the given type that the caller has any policy on. Backs the cross-service admin UI's 'what can I see + why' panel.",
    request_body = ExplainRequest,
    responses(
        (status = 200, description = "Per-resource evaluations", body = ApiResponse<ExplainResponse>),
        (status = 401, description = "Anonymous request"),
    )
)]
pub async fn explain_access(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(body): Json<ExplainRequest>,
) -> Result<Json<ApiResponse<ExplainResponse>>, RealtimeError> {
    // Step 1: find the candidate resource ids. We use the engine's
    // own list_visible_resource_ids so the candidate set is exactly
    // what /channels/list (and friends) would surface. This
    // includes Deny pairs so the explain UI can render "you have a
    // Deny policy on resource X" — owner-only resources are also
    // included automatically (the owner shortcut emits Allow pairs
    // for them).
    let registry = engine_resource_registry();
    let resource_auth_info = registry
        .lookup(body.resource_type as u32)
        .ok_or_else(|| {
            RealtimeError::AuthCoreError(mows_auth_core::AuthError::Evaluation(format!(
                "resource_type {} missing from realtime registry",
                body.resource_type as u32
            )))
        })?;

    let subject =
        subject_from_realtime(auth.requesting_user.as_ref(), &auth.requesting_user_groups);
    let app_view = mows_auth_core::AppView {
        id: auth.context_app.id.0,
        trusted: auth.context_app.trusted,
    };
    let store = RealtimePolicyStore::new(&state.database);

    // The engine has already folded Allow/Deny pairs and deduped
    // per id, so `visible` is the final visible set for the
    // (subject, app, action). For the explain panel we also want
    // to show resources the caller has a *Deny* on so an operator
    // can see the explicit deny — but `list_visible_resource_ids`
    // hides them by design. If the admin UI later needs the deny
    // ids surfaced too, a separate `PolicyStore::list_visible_resource_ids`
    // pass (the un-folded one) is the right hook. MVP: visible-set
    // only.
    let mut ids: Vec<uuid::Uuid> = mows_auth_core::list_visible_resource_ids(
        &store,
        resource_auth_info,
        &subject,
        app_view,
        body.action as u32,
    )
    .await?;
    ids.sort();

    if ids.is_empty() {
        return Ok(Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "0 resource(s)".to_string(),
            data: Some(ExplainResponse { evaluations: vec![] }),
        }));
    }

    // Step 2: run the candidate set through check_access. This
    // returns one AuthEvaluation per resource, each with the exact
    // reason variant that pinned the verdict — Owned / direct user
    // policy / via user-group policy / server-member / publicly
    // accessible / a matching Deny / NoMatchingAllowPolicy / etc.
    let result = check_resources_access_control(
        &state.database,
        auth.requesting_user.as_ref(),
        &auth.requesting_user_groups,
        &auth.context_app,
        body.resource_type,
        Some(&ids),
        body.action,
    )
    .await?;

    let count = result.evaluations.len();
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{count} resource(s)"),
        data: Some(ExplainResponse { evaluations: result.evaluations }),
    }))
}

