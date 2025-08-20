use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::user_groups::UserGroup,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/user_groups/list",
    request_body = ListUserGroupsRequestBody,
    responses(
        (status = 200, description = "Lists user groups", body = ApiResponse<ListUserGroupsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_user_groups(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUserGroupsRequestBody>,
) -> Result<Json<ApiResponse<ListUserGroupsResponseBody>>, FilezError> {
    let user_groups = with_timing!(
        UserGroup::list_with_user_access(
            &database,
            authentication_information.requesting_user.as_ref(),
            &authentication_information.requesting_app,
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list user groups",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User groups listed".to_string(),
        data: Some(ListUserGroupsResponseBody { user_groups }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}
