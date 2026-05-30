//! `POST /api/access_policies/explain` — per-resource AuthReason
//! for the cross-service authz admin UI (Phase 7).
//!
//! For every resource of `resource_type` that the caller has any
//! policy on (Allow set, as folded by the engine), return the
//! `mows_auth_core::AuthEvaluation` containing the typed
//! `AuthReason` variant that pinned the verdict — Owned /
//! AllowedByDirectUserPolicy / AllowedByDirectUserGroupPolicy {
//! via_user_group_id } / AllowedByPubliclyAccessible / etc.
//!
//! Sibling of `realtime-server`'s `/api/access_policies/explain`.
//! The two endpoints emit identical JSON so the admin UI fans out
//! across consumer services with no per-service adapter layer.

use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::{
        check::AuthEvaluation, AccessPolicy, AccessPolicyAction, AccessPolicyResourceType,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/explain",
    request_body = ExplainAccessRequestBody,
    description = "Returns the AuthReason for every resource of the given type that the caller has any policy on. Sibling of realtime-server's endpoint; both emit the same shape so the cross-service admin UI can fan out without per-service adapters.",
    responses(
        (
            status = 200,
            description = "Per-resource evaluations",
            body = ApiResponse<ExplainAccessResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn explain_access(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ExplainAccessRequestBody>,
) -> Result<Json<ApiResponse<ExplainAccessResponseBody>>, FilezError> {
    // Step 1: bound the candidate set. `get_all_resources_with_user_access`
    // delegates to `mows_auth_core::list_visible_resource_ids`, which
    // folds the per-store (Allow, Deny) pairs into the final visible
    // set — same answer as the regular list endpoints would surface.
    let mut ids = with_timing!(
        AccessPolicy::get_all_resources_with_user_access(
            &database,
            authentication_information.requesting_user.as_ref(),
            &authentication_information.requesting_app,
            request_body.access_policy_resource_type,
            request_body.access_policy_action,
        )
        .await?,
        "Database operation to list visible resource ids for explain",
        timing
    );
    ids.sort();

    if ids.is_empty() {
        return Ok(Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "0 resource(s)".to_string(),
            data: Some(ExplainAccessResponseBody { auth_evaluations: vec![] }),
        }));
    }

    // Step 2: run the candidate set through check_access so every
    // visible resource gets its typed AuthReason. We use the
    // AccessPolicy::check helper (not the lower-level
    // check_resources_access_control) so the user-group resolution
    // matches what every other filez handler does — single source
    // of truth for the engine boundary.
    let auth_result = with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            request_body.access_policy_resource_type,
            Some(&ids),
            request_body.access_policy_action,
        )
        .await?,
        "Database operation to check resources access control for explain",
        timing
    );

    let count = auth_result.evaluations.len();
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{count} resource(s)"),
        data: Some(ExplainAccessResponseBody {
            auth_evaluations: auth_result.evaluations,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ExplainAccessRequestBody {
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub access_policy_action: AccessPolicyAction,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ExplainAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}
