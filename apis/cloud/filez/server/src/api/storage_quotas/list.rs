use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{
            AccessPolicy, AccessPolicyAction, AccessPolicyResourceType, AccessPolicySubjectType,
        },
        apps::MowsApp,
        storage_quotas::StorageQuota,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};

#[utoipa::path(
    get,
    path = "/api/storage_quotas/list",
    request_body = ListStorageQuotasRequestBody,
    responses(
        (status = 200, description = "Lists storage quotas", body = ApiResponse<Vec<StorageQuota>>),
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

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::StorageQuota).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::StorageQuotasList).unwrap()
        )
        .await?
        .verify()?,
        "Access policy check for listing storage quotas",
        timing
    );
    let storage_quotas = with_timing!(
        StorageQuota::list_with_user_access(
            &db,
            &requesting_user.id,
            &requesting_app.id,
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

#[derive(serde::Serialize, serde::Deserialize, ToSchema, Clone)]
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
    Name,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListStorageQuotasResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}
