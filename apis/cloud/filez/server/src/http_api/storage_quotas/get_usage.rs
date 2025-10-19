use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
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
    post,
    path = "/api/storage_quotas/get_usage",
    description = "Get storage quota usage information",
    request_body = GetStorageQuotaUsageRequestBody,
    responses(
        (
            status = 200,
            description = "Got the storage quota usage",
            body = ApiResponse<GetStorageQuotaUsageResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_storage_quota_usage(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetStorageQuotaUsageRequestBody>,
) -> Result<Json<ApiResponse<GetStorageQuotaUsageResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            Some(&vec![request_body.storage_quota_id.into()]),
            AccessPolicyAction::StorageQuotasGet,
        )
        .await?
        .verify()?,
        "Access policy check for getting storage quota usage",
        timing
    );

    let (storage_quota, used_bytes) = with_timing!(
        StorageQuota::get_usage(
            &database,
            &authentication_information.requesting_user.unwrap().id,
            &request_body.storage_quota_id
        )
        .await?,
        "Database operation to get storage quota usage",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota usage retrieved".to_string(),
        data: Some(GetStorageQuotaUsageResponseBody {
            storage_quota,
            used_bytes,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetStorageQuotaUsageRequestBody {
    pub storage_quota_id: StorageQuotaId,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetStorageQuotaUsageResponseBody {
    pub storage_quota: StorageQuota,
    pub used_bytes: u64,
}
