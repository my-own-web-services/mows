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
    path = "/api/access_policies/{access_policy_id}",
    request_body = UpdateAccessPolicyRequestBody,
    responses(
        (status = 200, description = "Updates a access policy", body = ApiResponse<AccessPolicy>),
    )
)]
pub async fn update_access_policy(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(access_policy_id): Path<Uuid>,
    Json(req_body): Json<UpdateAccessPolicyRequestBody>,
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
            Some(&vec![access_policy_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::AccessPolicyUpdate).unwrap(),
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
            &req_body.name,
            req_body.subject_type,
            req_body.subject_id,
            req_body.context_app_id,
            req_body.resource_type,
            req_body.resource_id,
            req_body.actions,
            req_body.effect,
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
