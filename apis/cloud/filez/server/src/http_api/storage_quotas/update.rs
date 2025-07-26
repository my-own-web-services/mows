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
    put,
    path = "/api/storage_quotas/update",
    request_body = UpdateStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Updates a storage quota", body = ApiResponse<StorageQuota>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_storage_quota(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<StorageQuota>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::StorageQuota,
            Some(&[request_body.subject_id]),
            AccessPolicyAction::StorageQuotasUpdate
        )
        .await?
        .verify()?,
        "Access policy check for updating storage quota",
        timing
    );
    let storage_quota = with_timing!(
        StorageQuota::update(
            &database,
            request_body.subject_type,
            &request_body.subject_id,
            &request_body.storage_location_id,
            request_body.quota_bytes.into(),
        )
        .await?,
        "Database operation to update storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Storage quota updated".to_string(),
        data: Some(storage_quota),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateStorageQuotaRequestBody {
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,
    pub quota_bytes: i64,
}
