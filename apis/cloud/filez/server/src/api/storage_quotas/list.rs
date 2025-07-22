use crate::{
    errors::FilezError,
    models::{apps::MowsApp, storage_quotas::StorageQuota, users::FilezUser},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

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
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListStorageQuotasRequestBody>,
) -> Result<Json<ApiResponse<Vec<StorageQuota>>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    let storage_quotas = with_timing!(
        StorageQuota::list_with_user_access(
            &db,
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
