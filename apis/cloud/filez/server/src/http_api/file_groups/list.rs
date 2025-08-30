use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::file_groups::FileGroup,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/list",
    request_body = ListFileGroupsRequestBody,
    description = "List file groups",
    responses(
        (
            status = 200,
            description = "Listed file groups",
            body = ApiResponse<ListFileGroupsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_file_groups(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListFileGroupsRequestBody>,
) -> Result<Json<ApiResponse<ListFileGroupsResponseBody>>, FilezError> {
    let (file_groups, total_count) = with_timing!(
        FileGroup::list_with_user_access(
            &database,
            authentication_information.requesting_user.as_ref(),
            &authentication_information.requesting_app,
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list file groups",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "File groups listed".to_string(),
        data: Some(ListFileGroupsResponseBody {
            file_groups,
            total_count,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListFileGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListFileGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
    pub total_count: u64,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub enum ListFileGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}
