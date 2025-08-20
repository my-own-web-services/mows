use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        storage_quotas::{StorageQuota, StorageQuotaId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/storage_quotas/update",
    request_body = UpdateStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Updates a storage quota", body = ApiResponse<UpdateStorageQuotaResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_storage_quota(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<UpdateStorageQuotaResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            Some(&[request_body.storage_quota_id.into()]),
            AccessPolicyAction::StorageQuotasUpdate,
        )
        .await?
        .verify()?,
        "Access policy check for updating storage quota",
        timing
    );
    let storage_quota = with_timing!(
        StorageQuota::update(
            &database,
            request_body.storage_quota_id,
            request_body.quota_bytes
        )
        .await?,
        "Database operation to update storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota updated".to_string(),
        data: Some(UpdateStorageQuotaResponseBody { storage_quota }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateStorageQuotaRequestBody {
    pub storage_quota_id: StorageQuotaId,
    pub quota_bytes: u64,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct UpdateStorageQuotaResponseBody {
    pub storage_quota: StorageQuota,
}
