use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

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
    post,
    path = "/api/access_policies/get",
    request_body = GetAccessPolicyRequestBody,
    description = "Get access policies from the server by their IDs",
    responses(
        (
            status = 200,
            description = "Got the access policies",
            body = ApiResponse<GetAccessPolicyResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_access_policy(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetAccessPolicyRequestBody>,
) -> Result<Json<ApiResponse<GetAccessPolicyResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::AccessPolicy,
            Some(
                &request_body
                    .access_policy_ids
                    .clone()
                    .into_iter()
                    .map(|id| id.into())
                    .collect::<Vec<_>>()
            ),
            AccessPolicyAction::AccessPoliciesGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let access_policies = with_timing!(
        AccessPolicy::get_many_by_ids(&database, &request_body.access_policy_ids).await?,
        "Database operation to get access policy by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Access policies retrieved".to_string(),
        data: Some(GetAccessPolicyResponseBody { access_policies }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetAccessPolicyRequestBody {
    pub access_policy_ids: Vec<AccessPolicyId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetAccessPolicyResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}
