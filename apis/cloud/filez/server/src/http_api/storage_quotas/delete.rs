use axum::{extract::State, Extension, Json};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
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
    delete,
    path = "/api/storage_quotas/delete",
    request_body = DeleteStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Deletes a storage quota", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn delete_storage_quota(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
        ..
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::StorageQuota,
            Some(&[request_body.subject_id]),
            AccessPolicyAction::StorageQuotasDelete
        )
        .await?
        .verify()?,
        "Access policy check for deleting storage quota",
        timing
    );

    with_timing!(
        StorageQuota::delete(
            &database,
            request_body.subject_type,
            &request_body.subject_id,
            &request_body.storage_location_id,
        )
        .await?,
        "Database operation to delete storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success{},
        message: "Storage quota deleted".to_string(),
        data: None,
    }))
}

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Clone)]
pub struct DeleteStorageQuotaRequestBody {
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,
}
