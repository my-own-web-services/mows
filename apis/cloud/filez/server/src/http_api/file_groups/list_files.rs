use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_groups::{FileGroup, FileGroupId},
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
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_files_by_file_groups(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListFilesRequestBody>,
) -> Result<Json<ApiResponse<ListFilesResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![request_body.file_group_id.into()]),
            AccessPolicyAction::FileGroupsListFiles,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_files_query = FileGroup::list_files(
        &database,
        &request_body.file_group_id,
        request_body.from_index,
        request_body.limit,
        request_body.sort,
    );

    let file_group_item_count_query =
        FileGroup::get_file_count(&database, &request_body.file_group_id);

    // join the two futures to run them concurrently
    let (files, total_count): (Vec<FilezFile>, u64) = with_timing!(
        match tokio::join!(list_files_query, file_group_item_count_query) {
            (Ok(files), Ok(total_count)) => (files, total_count),
            (Err(e), _) => return Err(e.into()),
            (_, Err(e)) => return Err(e.into()),
        },
        "Database operations to list files and get file count",
        timing
    );

    return Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Got file list".to_string(),
        data: Some(ListFilesResponseBody { files, total_count }),
    }));
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListFilesRequestBody {
    pub file_group_id: FileGroupId,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort: Option<ListFilesSorting>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ListFilesSorting {
    StoredSortOrder(ListFilesStoredSortOrder),
    SortOrder(ListFilesSortOrder),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListFilesSortOrder {
    pub sort_by: ListFilesSortBy,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ListFilesSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListFilesStoredSortOrder {
    pub stored_sort_order_id: Uuid,
    pub direction: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: u64,
}
