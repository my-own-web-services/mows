use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    auth_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::FileGroup,
        files::FilezFile,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/list_files",
    request_body = ListFilesRequestBody,
    responses(
        (status = 200, description = "Lists the files in a given group", body = ApiResponse<ListFilesResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_files_by_file_groups(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListFilesRequestBody>,
) -> Result<Json<ApiResponse<ListFilesResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![request_body.file_group_id]),
            AccessPolicyAction::FileGroupsListFiles,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_files_query = FileGroup::list_files(
        &db,
        &request_body.file_group_id,
        request_body.from_index,
        request_body.limit,
        request_body.sort,
    );

    let file_group_item_count_query = FileGroup::get_file_count(&db, &request_body.file_group_id);

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
