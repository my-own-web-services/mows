//! POST /api/access_policies/revoke/{access_policy_id}
//!
//! Soft-delete an access policy. The row stays in the table (audit
//! trail) but the PolicyStore lifecycle filter
//! (`NOT revoked AND …`) excludes it from every subsequent
//! check_access. Idempotent.
//!
//! CONSENT_FLOW.md "Revocation": the Picker UI's per-policy revoke
//! button hits this endpoint. Bulk revocation by policy_bundle_id is
//! a separate endpoint (USAGE_LIMITS.md "Bulk revocation") that lands
//! when the Picker UI ships.

use crate::errors::AuthResultExt;
use crate::validation::Json;
use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::{
        AccessPolicy, AccessPolicyAction, AccessPolicyId, AccessPolicyResourceType,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{
    extract::{Path, State},
    Extension,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/revoke/{access_policy_id}",
    description = "Revoke an access policy (soft-delete; preserves audit trail).",
    params(
        (
            "access_policy_id" = AccessPolicyId,
            Path,
            description = "The ID of the access policy to revoke"
        ),
    ),
    responses(
        (
            status = 200,
            description = "Revoked the access policy",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 403,
            description = "Forbidden — caller does not have AccessPoliciesUpdate on this policy",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn revoke_access_policy(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<AccessPolicyId>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    // Revocation is gated by AccessPoliciesUpdate — same authority as
    // editing the policy. A future "AccessPoliciesRevoke" action could
    // be split off if revocation needs different governance, but for
    // now: if you can update it, you can revoke it.
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::AccessPolicy,
            Some(&vec![access_policy_id.into()]),
            AccessPolicyAction::AccessPoliciesUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        AccessPolicy::revoke_one(&database, &access_policy_id.into()).await?,
        "Database operation to revoke access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Access policy revoked".to_string(),
        data: None,
    }))
}
