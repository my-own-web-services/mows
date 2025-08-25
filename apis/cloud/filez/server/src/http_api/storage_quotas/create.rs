use axum::{extract::State, Extension};
use crate::validation::Json;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
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
    description = "Create a new storage quota in the database",
    responses(
        (
            status = 200,
            description = "Created the new storage quota",
            body = ApiResponse<CreateStorageQuotaResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
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

    let created_storage_quota = StorageQuota::new(
        authentication_information
            .requesting_user
            .unwrap()
            .id
            .into(),
        request_body.storage_quota_name,
        request_body.storage_quota_subject_type,
        request_body.storage_quota_subject_id,
        request_body.storage_location_id,
        request_body.storage_quota_bytes.into(),
    )?;

    with_timing!(
        StorageQuota::create(&database, &created_storage_quota).await?,
        "Database operation to create storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quota created".to_string(),
        data: Some(CreateStorageQuotaResponseBody {
            created_storage_quota,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateStorageQuotaRequestBody {
    pub storage_quota_subject_type: StorageQuotaSubjectType,
    pub storage_quota_subject_id: StorageQuotaSubjectId,
    pub storage_location_id: StorageLocationId,
    pub storage_quota_bytes: u64,
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    pub storage_quota_name: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateStorageQuotaResponseBody {
    pub created_storage_quota: StorageQuota,
}
