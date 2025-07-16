use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{
            AccessPolicy, AccessPolicyAction, AccessPolicyResourceType, AccessPolicySubjectType,
        },
        apps::MowsApp,
        storage_quotas::StorageQuota,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/storage_quotas/create",
    request_body = CreateStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Creates a new storage quota", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn create_storage_quota(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
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
            AccessPolicyResourceType::StorageQuota,
            None,
            AccessPolicyAction::StorageQuotasCreate
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let storage_quota = StorageQuota::new(
        requesting_user.id,
        request_body.subject_type,
        request_body.subject_id,
        request_body.storage_location_id,
        request_body.quota_bytes.into(),
        request_body.ignore_quota,
    );

    with_timing!(
        StorageQuota::create(&db, &storage_quota).await?,
        "Database operation to create storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Storage quota created".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateStorageQuotaRequestBody {
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,
    pub quota_bytes: i64,
    pub ignore_quota: bool,
}
