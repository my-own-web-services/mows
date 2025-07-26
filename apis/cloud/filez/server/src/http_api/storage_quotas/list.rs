use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
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
        (status = 200, description = "Lists storage quotas", body = ApiResponse<Vec<StorageQuota>>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_storage_quotas(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListStorageQuotasRequestBody>,
) -> Result<Json<ApiResponse<Vec<StorageQuota>>>, FilezError> {
    let storage_quotas = with_timing!(
        StorageQuota::list_with_user_access(
            &database,
            &requesting_user.id,
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
        status: ApiResponseStatus::Success,
        message: "Storage quotas retrieved".to_string(),
        data: Some(storage_quotas),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListStorageQuotasRequestBody {
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
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
