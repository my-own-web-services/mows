use crate::{
    errors::FilezError,
    models::{
        access_policies::{
            AccessPolicy, AccessPolicyAction, AccessPolicyEffect, AccessPolicyResourceType,
            AccessPolicySubjectType,
        },
        apps::MowsApp,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    put,
    path = "/api/access_policies/update/{access_policy_id}",
    request_body = UpdateAccessPolicyRequestBody,
    responses(
        (status = 200, description = "Updates a access policy", body = ApiResponse<AccessPolicy>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_access_policy(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<Uuid>,
    Json(request_body): Json<UpdateAccessPolicyRequestBody>,
) -> Result<Json<ApiResponse<AccessPolicy>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::AccessPolicy,
            Some(&vec![access_policy_id]),
            AccessPolicyAction::AccessPoliciesUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        AccessPolicy::update(
            &db,
            &access_policy_id,
            &request_body.name,
            request_body.subject_type,
            request_body.subject_id,
            request_body.context_app_id,
            request_body.resource_type,
            request_body.resource_id,
            request_body.actions,
            request_body.effect,
        )
        .await?,
        "Database operation to update access policy",
        timing
    );

    let access_policy = with_timing!(
        AccessPolicy::get_by_id(&db, &access_policy_id).await?,
        "Database operation to get updated access policy",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Access policy updated".to_string(),
        data: Some(access_policy),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateAccessPolicyRequestBody {
    pub name: String,
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub context_app_id: Option<Uuid>,
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Option<Uuid>,
    pub actions: Vec<AccessPolicyAction>,
    pub effect: AccessPolicyEffect,
}
