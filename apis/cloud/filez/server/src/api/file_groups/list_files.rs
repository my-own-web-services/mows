use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_groups::FileGroup,
        files::FilezFile,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/list_files",
    request_body = ListFilesRequestBody,
    responses(
        (status = 200, description = "Lists the files in a given group", body = ApiResponse<ListFilesResponseBody>),
    )
)]
pub async fn list_files(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<ListFilesRequestBody>,
) -> Result<Json<ApiResponse<ListFilesResponseBody>>, FilezError> {
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            Some(&vec![req_body.file_group_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupsListFiles).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_files_query = FileGroup::list_files(
        &db,
        &req_body.file_group_id,
        req_body.from_index,
        req_body.limit,
        req_body.sort,
    );

    let file_group_item_count_query = FileGroup::get_file_count(&db, &req_body.file_group_id);

    // join the two futures to run them concurrently
    let (files, total_count): (Vec<FilezFile>, i64) = with_timing!(
        match tokio::join!(list_files_query, file_group_item_count_query) {
            (Ok(files), Ok(total_count)) => (files, total_count),
            (Err(e), _) => return Err(e.into()),
            (_, Err(e)) => return Err(e.into()),
        },
        "Database operations to list files and get file count",
        timing
    );

    return Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got file list".to_string(),
        data: Some(ListFilesResponseBody { files, total_count }),
    }));
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFilesRequestBody {
    pub file_group_id: Uuid,
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort: Option<ListFilesSorting>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListFilesSorting {
    StoredSortOrder(ListFilesStoredSortOrder),
    SortOrder(ListFilesSortOrder),
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFilesSortOrder {
    pub sort_by: ListFilesSortBy,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListFilesSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFilesStoredSortOrder {
    pub id: Uuid,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: i64,
}
