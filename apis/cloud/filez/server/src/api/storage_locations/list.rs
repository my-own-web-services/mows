use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        storage_locations::{StorageLocation, StorageLocationListItem},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/storage_locations/list",
    request_body = ListStorageLocationsRequestBody,
    responses(
        (status = 200, description = "Lists all Storage Locations", body = ApiResponse<ListStorageLocationsResponseBody>),
    )
)]
pub async fn list_storage_locations(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListStorageLocationsRequestBody>,
) -> Result<Json<ApiResponse<ListStorageLocationsResponseBody>>, FilezError> {
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
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::StorageLocation,
            None,
            AccessPolicyAction::StorageLocationsList,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let storage_locations = with_timing!(
        StorageLocation::list(&db, request_body.sort_by, request_body.sort_order,).await?,
        "Database operation to list storage locations",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Storage locations listed".to_string(),
        data: Some(ListStorageLocationsResponseBody { storage_locations }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListStorageLocationsRequestBody {
    pub sort_by: Option<ListStorageLocationsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListStorageLocationsResponseBody {
    pub storage_locations: Vec<StorageLocationListItem>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}
