use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::users::{FilezUser, ListedFilezUser},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};
use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/users/list",
    request_body = ListUsersRequestBody,
    responses(
        (status = 200, description = "Lists all Users", body = ApiResponse<ListUsersResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_users(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUsersRequestBody>,
) -> Result<Json<ApiResponse<ListUsersResponseBody>>, FilezError> {
    let users = with_timing!(
        FilezUser::list_with_user_access(
            &database,
            authentication_information.requesting_user.as_ref(),
            &authentication_information.requesting_app,
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list users",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Users listed".to_string(),
        data: Some(ListUsersResponseBody { users }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListUsersRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUsersSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ListUsersResponseBody {
    pub users: Vec<ListedFilezUser>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ListUsersSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}
