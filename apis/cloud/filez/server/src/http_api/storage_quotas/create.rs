use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::{
        access_policies::{
            AccessPolicy, AccessPolicyAction, AccessPolicyResourceType, AccessPolicySubjectType,
        },
        storage_quotas::StorageQuota,
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
        (status = 200, description = "Creates a new storage quota", body = ApiResponse<CreateStorageQuotaResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn create_storage_quota(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<CreateStorageQuotaResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
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
        request_body.name,
        request_body.subject_type,
        request_body.subject_id,
        request_body.storage_location_id,
        request_body.quota_bytes.into(),
    );

    with_timing!(
        StorageQuota::create(&database, &storage_quota).await?,
        "Database operation to create storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Storage quota created".to_string(),
        data: Some(CreateStorageQuotaResponseBody { storage_quota }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateStorageQuotaRequestBody {
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,
    pub quota_bytes: i64,
    pub name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateStorageQuotaResponseBody {
    pub storage_quota: StorageQuota,
}
