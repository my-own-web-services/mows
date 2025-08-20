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
    path = "/api/storage_quotas/delete",
    request_body = DeleteStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Deletes a storage quota", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_storage_quota(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            Some(&[request_body.storage_quota_id.into()]),
            AccessPolicyAction::StorageQuotasDelete,
        )
        .await?
        .verify()?,
        "Access policy check for deleting storage quota",
        timing
    );

    with_timing!(
        StorageQuota::delete(&database, request_body.storage_quota_id).await?,
        "Database operation to delete storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota deleted".to_string(),
        data: None,
    }))
}

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Clone, Debug)]
pub struct DeleteStorageQuotaRequestBody {
    pub storage_quota_id: StorageQuotaId,
}
