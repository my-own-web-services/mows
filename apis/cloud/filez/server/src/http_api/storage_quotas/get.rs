use axum::{extract::State, Extension, Json};
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
    path = "/api/storage_quotas/get",
    request_body = GetStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Gets a storage quota", body = ApiResponse<StorageQuota>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_storage_quota(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<StorageQuota>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            Some(&[request_body.storage_quota_id.into()]),
            AccessPolicyAction::StorageQuotasGet,
        )
        .await?
        .verify()?,
        "Access policy check for getting storage quota",
        timing
    );
    let storage_quota = with_timing!(
        StorageQuota::get(&database, request_body.storage_quota_id,).await?,
        "Database operation to get storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota retrieved".to_string(),
        data: Some(storage_quota),
    }))
}

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Clone, Debug)]
pub struct GetStorageQuotaRequestBody {
    pub storage_quota_id: StorageQuotaId,
}
