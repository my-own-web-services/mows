use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::access_policies::{
        AccessPolicy, AccessPolicyAction, AccessPolicyEffect, AccessPolicyResourceType,
        AccessPolicySubjectType,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/create",
    request_body = CreateAccessPolicyRequestBody,
    responses(
        (status = 200, description = "Creates a new access policy", body = ApiResponse<AccessPolicy>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn create_access_policy(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateAccessPolicyRequestBody>,
) -> Result<Json<ApiResponse<AccessPolicy>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::AccessPolicy,
            None,
            AccessPolicyAction::AccessPoliciesCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let access_policy = AccessPolicy::new(
        &request_body.name,
        requesting_user.id,
        request_body.subject_type,
        request_body.subject_id,
        request_body.context_app_id,
        request_body.resource_type,
        request_body.resource_id,
        request_body.actions,
        request_body.effect,
    );

    with_timing!(
        AccessPolicy::create(&database, &access_policy).await?,
        "Database operation to create access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Access policy created".to_string(),
        data: Some(access_policy),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateAccessPolicyRequestBody {
    pub name: String,
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub context_app_id: Option<Uuid>,
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Option<Uuid>,
    pub actions: Vec<AccessPolicyAction>,
    pub effect: AccessPolicyEffect,
}
