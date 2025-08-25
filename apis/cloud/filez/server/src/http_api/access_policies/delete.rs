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
use crate::validation::Json;

#[utoipa::path(
    delete,
    path = "/api/access_policies/delete/{access_policy_id}",
    description = "Delete an access policy by its ID",
    params(
        (
            "access_policy_id" = AccessPolicyId,
            Path,
            description = "The ID of the access policy to delete"
        ),
    ),
    responses(
        (
            status = 200,
            description = "Deleted the access policy",
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
pub async fn delete_access_policy(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<AccessPolicyId>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::AccessPolicy,
            Some(&vec![access_policy_id.into()]),
            AccessPolicyAction::AccessPoliciesDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        AccessPolicy::delete_one(&database, &access_policy_id.into()).await?,
        "Database operation to delete access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Access policy deleted".to_string(),
        data: None,
    }))
}
