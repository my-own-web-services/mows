use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        storage_locations::{StorageLocation, StorageLocationListItem},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/storage_locations/list",
    request_body = ListStorageLocationsRequestBody,
    responses(
        (status = 200, description = "Lists all Storage Locations", body = ApiResponse<ListStorageLocationsResponseBody>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_storage_locations(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListStorageLocationsRequestBody>,
) -> Result<Json<ApiResponse<ListStorageLocationsResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
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
        StorageLocation::list(&database, request_body.sort_by, request_body.sort_order,).await?,
        "Database operation to list storage locations",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Storage locations listed".to_string(),
        data: Some(ListStorageLocationsResponseBody { storage_locations }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListStorageLocationsRequestBody {
    pub sort_by: Option<ListStorageLocationsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListStorageLocationsResponseBody {
    pub storage_locations: Vec<StorageLocationListItem>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}
