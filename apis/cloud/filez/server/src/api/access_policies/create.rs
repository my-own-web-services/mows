use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

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
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/create",
    request_body = CreateAccessPolicyRequestBody,
    responses(
        (status = 200, description = "Creates a new access policy", body = ApiResponse<AccessPolicy>),
    )
)]
pub async fn create_access_policy(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<CreateAccessPolicyRequestBody>,
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
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::AccessPolicy).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::AccessPolicyCreate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let access_policy = AccessPolicy::new(
        &req_body.name,
        req_body.subject_type,
        req_body.subject_id,
        req_body.context_app_id,
        req_body.resource_type,
        req_body.resource_id,
        req_body.actions,
        req_body.effect,
    );

    with_timing!(
        AccessPolicy::create(&db, &access_policy).await?,
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
