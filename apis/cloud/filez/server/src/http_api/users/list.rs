use crate::{
    errors::FilezError,
    http_api::authentication_middleware::AuthenticationInformation,
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
pub async fn list_users(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUsersRequestBody>,
) -> Result<Json<ApiResponse<ListUsersResponseBody>>, FilezError> {
    let users = with_timing!(
        FilezUser::list_with_user_access(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
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
        status: ApiResponseStatus::Success,
        message: "Users listed".to_string(),
        data: Some(ListUsersResponseBody { users }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListUsersRequestBody {
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<ListUsersSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListUsersResponseBody {
    pub users: Vec<ListedFilezUser>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListUsersSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}
