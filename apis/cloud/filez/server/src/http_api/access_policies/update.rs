use crate::validation::Json;
use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::access_policies::{
        AccessPolicy, AccessPolicyAction, AccessPolicyId, AccessPolicyResourceType,
        UpdateAccessPolicyChangeset,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    put,
    path = "/api/access_policies/update",
    request_body = UpdateAccessPolicyRequestBody,
    description = "Update an existing access policy",
    responses(
        (
            status = 200,
            description = "Updated the access policy",
            body = ApiResponse<UpdateAccessPolicyResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_access_policy(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateAccessPolicyRequestBody>,
) -> Result<Json<ApiResponse<UpdateAccessPolicyResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::AccessPolicy,
            Some(&vec![request_body.access_policy_id.into()]),
            AccessPolicyAction::AccessPoliciesUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_access_policy = with_timing!(
        AccessPolicy::update_one(
            &database,
            &request_body.access_policy_id,
            request_body.changeset,
        )
        .await?,
        "Database operation to update access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Access policy updated".to_string(),
        data: Some(UpdateAccessPolicyResponseBody {
            updated_access_policy,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateAccessPolicyRequestBody {
    pub access_policy_id: AccessPolicyId,
    pub changeset: UpdateAccessPolicyChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateAccessPolicyResponseBody {
    pub updated_access_policy: AccessPolicy,
}
