use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    auth_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::file_groups::FileGroup,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/list",
    request_body = ListFileGroupsRequestBody,
    responses(
        (status = 200, description = "Lists file groups", body = ApiResponse<ListFileGroupsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_file_groups(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListFileGroupsRequestBody>,
) -> Result<Json<ApiResponse<ListFileGroupsResponseBody>>, FilezError> {
    let file_groups = with_timing!(
        FileGroup::list_with_user_access(
            &db,
            &requesting_user.id,
            &requesting_app.id,
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
        status: ApiResponseStatus::Success,
        message: "File groups listed".to_string(),
        data: Some(ListFileGroupsResponseBody { file_groups }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFileGroupsRequestBody {
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<ListFileGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListFileGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}
