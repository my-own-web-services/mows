use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
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
    responses(
        (status = 200, description = "Checks if the requested resources are available to this user", body = ApiResponse<CheckResourceAccessResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn check_resource_access(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CheckResourceAccessRequestBody>,
) -> Result<Json<ApiResponse<CheckResourceAccessResponseBody>>, FilezError> {
    let auth_result = with_timing!(
        AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            request_body.resource_type,
            request_body.resource_ids.as_deref(),
            request_body.action,
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

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessRequestBody {
    pub resource_ids: Option<Vec<Uuid>>,
    pub resource_type: AccessPolicyResourceType,
    pub action: AccessPolicyAction,
    pub requesting_app_origin: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}
