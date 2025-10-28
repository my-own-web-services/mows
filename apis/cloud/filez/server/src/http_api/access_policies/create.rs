use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            AccessPolicy, AccessPolicyAction, AccessPolicyEffect, AccessPolicyResourceType,
            AccessPolicySubjectId, AccessPolicySubjectType,
        },
        apps::MowsAppId,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/create",
    request_body = CreateAccessPolicyRequestBody,
    description = "Create a new access policy",
    responses(
        (
            status = 200,
            description = "Created the access policy",
            body = ApiResponse<CreateAccessPolicyResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_access_policy(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateAccessPolicyRequestBody>,
) -> Result<Json<ApiResponse<CreateAccessPolicyResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            request_body.access_policy_resource_type,
            request_body
                .resource_id
                .and_then(|id| Some(vec![id]))
                .as_deref(),
            AccessPolicyAction::AccessPoliciesCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let created_access_policy = with_timing!(
        AccessPolicy::create_one(
            &database,
            &request_body.access_policy_name,
            authentication_information
                .requesting_user
                .unwrap()
                .id
                .into(),
            request_body.access_policy_subject_type,
            request_body.access_policy_subject_id,
            request_body.context_app_ids,
            request_body.access_policy_resource_type,
            request_body.resource_id,
            request_body.access_policy_actions,
            request_body.access_policy_effect,
        )
        .await?,
        "Database operation to create access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Access policy created".to_string(),
        data: Some(CreateAccessPolicyResponseBody {
            created_access_policy,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateAccessPolicyRequestBody {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    pub access_policy_name: String,
    pub access_policy_subject_type: AccessPolicySubjectType,
    pub access_policy_subject_id: AccessPolicySubjectId,
    pub context_app_ids: Vec<MowsAppId>,
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub resource_id: Option<Uuid>,
    pub access_policy_actions: Vec<AccessPolicyAction>,
    pub access_policy_effect: AccessPolicyEffect,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateAccessPolicyResponseBody {
    pub created_access_policy: AccessPolicy,
}
