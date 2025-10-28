use axum::{
    extract::{Path, State},
    Extension, Json,
};

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
    delete,
    path = "/api/storage_quotas/delete/{storage_quota_id}",
    description = "Delete a storage quota by its ID",
    params(
        (
            "storage_quota_id" = StorageQuotaId,
            Path,
            description = "The ID of the storage quota to delete"
        ),
    ),
    responses(
        (
            status = 200,
            description = "Deleted the storage quota",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_storage_quota(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(storage_quota_id): Path<StorageQuotaId>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::StorageQuota,
            Some(&[storage_quota_id.into()]),
            AccessPolicyAction::StorageQuotasDelete,
        )
        .await?
        .verify()?,
        "Access policy check for deleting storage quota",
        timing
    );

    with_timing!(
        StorageQuota::delete_one(&database, storage_quota_id).await?,
        "Database operation to delete storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota deleted".to_string(),
        data: None,
    }))
}
