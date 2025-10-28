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
    description = "Get storage quotas by their IDs",
    request_body = GetStorageQuotaRequestBody,
    responses(
        (
            status = 200,
            description = "Got the storage quotas",
            body = ApiResponse<GetStorageQuotaResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_storage_quotas(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<GetStorageQuotaResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            Some(
                &request_body
                    .storage_quota_ids
                    .clone()
                    .into_iter()
                    .map(|id| id.into())
                    .collect::<Vec<Uuid>>()
            ),
            AccessPolicyAction::StorageQuotasGet,
        )
        .await?
        .verify()?,
        "Access policy check for getting storage quota",
        timing
    );
    let storage_quotas = with_timing!(
        StorageQuota::get_many_by_id(&database, request_body.storage_quota_ids).await?,
        "Database operation to get storage quotas",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quotas retrieved".to_string(),
        data: Some(GetStorageQuotaResponseBody { storage_quotas }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetStorageQuotaRequestBody {
    pub storage_quota_ids: Vec<StorageQuotaId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetStorageQuotaResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}
