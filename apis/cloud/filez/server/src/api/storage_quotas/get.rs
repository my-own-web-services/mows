use axum::{extract::State, Extension, Json};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    auth_middleware::AuthenticatedUserAndApp,
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
    get,
    path = "/api/storage_quotas/get",
    request_body = GetStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Gets a storage quota", body = ApiResponse<StorageQuota>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_storage_quota(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<StorageQuota>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::StorageQuota,
            Some(&[request_body.subject_id]),
            AccessPolicyAction::StorageQuotasGet
        )
        .await?
        .verify()?,
        "Access policy check for getting storage quota",
        timing
    );
    let storage_quota = with_timing!(
        StorageQuota::get(
            &db,
            request_body.subject_type,
            &request_body.subject_id,
            &request_body.storage_location_id,
        )
        .await?,
        "Database operation to get storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Storage quota retrieved".to_string(),
        data: Some(storage_quota),
    }))
}

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Clone)]
pub struct GetStorageQuotaRequestBody {
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,
}
