use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

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
    path = "/api/access_policies/check",
    request_body = CheckResourceAccessRequestBody,
    description = "Check if the user has access to the requested resources",
    responses(
        (
            status = 200,
            description = "Checked if the requested resources are available to this user",
            body = ApiResponse<CheckResourceAccessResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn check_resource_access(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CheckResourceAccessRequestBody>,
) -> Result<Json<ApiResponse<CheckResourceAccessResponseBody>>, FilezError> {
    let auth_result = with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            request_body.access_policy_resource_type,
            request_body.resource_ids.as_deref(),
            request_body.access_policy_action,
        )
        .await?,
        "Database operation to check resources access control",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Auth results retrieved".to_string(),
        data: Some(CheckResourceAccessResponseBody {
            auth_evaluations: auth_result.evaluations,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CheckResourceAccessRequestBody {
    pub resource_ids: Option<Vec<Uuid>>,
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub access_policy_action: AccessPolicyAction,
    pub requesting_app_origin: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}
