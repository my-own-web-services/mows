use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        storage_locations::StorageLocationId,
        storage_quotas::{StorageQuota, StorageQuotaSubjectId, StorageQuotaSubjectType},
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
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_storage_quota(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<CreateStorageQuotaResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            None,
            AccessPolicyAction::StorageQuotasCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let storage_quota = StorageQuota::new(
        authentication_information
            .requesting_user
            .unwrap()
            .id
            .into(),
        request_body.name,
        request_body.storage_quota_subject_type,
        request_body.storage_quota_subject_id,
        request_body.storage_location_id,
        request_body.quota_bytes.into(),
    )?;

    with_timing!(
        StorageQuota::create(&database, &storage_quota).await?,
        "Database operation to create storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota created".to_string(),
        data: Some(CreateStorageQuotaResponseBody { storage_quota }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct CreateStorageQuotaRequestBody {
    pub storage_quota_subject_type: StorageQuotaSubjectType,
    pub storage_quota_subject_id: StorageQuotaSubjectId,
    pub storage_location_id: StorageLocationId,
    pub quota_bytes: u64,
    pub name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct CreateStorageQuotaResponseBody {
    pub storage_quota: StorageQuota,
}
