use axum::{
    extract::{Path, State},
    Extension, Json,
};

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

#[utoipa::path(
    get,
    path = "/api/access_policies/get/{access_policy_id}",
    params(
        ("access_policy_id" = Uuid, Path, description = "The ID of the access policy to retrieve"),
    ),
    responses(
        (status = 200, description = "Gets a access policy by ID", body = ApiResponse<AccessPolicy>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_access_policy(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<AccessPolicyId>,
) -> Result<Json<ApiResponse<AccessPolicy>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::AccessPolicy,
            Some(&vec![access_policy_id.into()]),
            AccessPolicyAction::AccessPoliciesGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let access_policy = with_timing!(
        AccessPolicy::get_by_id(&database, &access_policy_id).await?,
        "Database operation to get access policy by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Access policy retrieved".to_string(),
        data: Some(access_policy),
    }))
}
