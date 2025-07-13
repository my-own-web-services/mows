use axum::{extract::State, http::HeaderMap, Extension, Json};
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
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    delete,
    path = "/api/storage_quotas/delete",
    request_body = DeleteStorageQuotaRequestBody,
    responses(
        (status = 200, description = "Deletes a storage quota", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn delete_storage_quota(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteStorageQuotaRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
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
            Some(&[request_body.subject_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::StorageQuotasDelete).unwrap()
        )
        .await?
        .verify()?,
        "Access policy check for deleting storage quota",
        timing
    );

    with_timing!(
        StorageQuota::delete(
            &db,
            request_body.subject_type,
            &request_body.subject_id,
            &request_body.storage_location_id,
        )
        .await?,
        "Database operation to delete storage quota",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
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
