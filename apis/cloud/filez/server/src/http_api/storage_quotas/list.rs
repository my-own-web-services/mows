use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::storage_quotas::StorageQuota,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/storage_quotas/list",
    request_body = ListStorageQuotasRequestBody,
    responses(
        (status = 200, description = "Lists storage quotas", body = ApiResponse<ListStorageQuotasResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_storage_quotas(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListStorageQuotasRequestBody>,
) -> Result<Json<ApiResponse<Vec<StorageQuota>>>, FilezError> {
    let requesting_user = authentication_information.requesting_user.ok_or_else(|| {
        FilezError::Unauthorized("User must be authenticated to list storage quotas".to_string())
    })?;

    let storage_quotas = with_timing!(
        StorageQuota::list_with_user_access(
            &database,
            &requesting_user.id,
            &authentication_information.requesting_app,
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list storage quotas",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage quotas retrieved".to_string(),
        data: Some(storage_quotas),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListStorageQuotasRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListStorageQuotasSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListStorageQuotasSortBy {
    CreatedTime,
    ModifiedTime,
    SubjectType,
    SubjectId,
    StorageLocationId,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListStorageQuotasResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}
