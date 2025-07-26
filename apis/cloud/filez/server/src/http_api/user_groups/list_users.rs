use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    http_api::authentication_middleware::AuthenticationInformation,
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/list_users/{user_group_id}",
    request_body = ListUsersRequestBody,
    responses(
        (status = 200, description = "Lists the users in a given group", body = ApiResponse<ListUsersResponseBody>),
    )
)]
pub async fn list_users_by_user_group(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<Uuid>,
    Json(request_body): Json<ListUsersRequestBody>,
) -> Result<Json<ApiResponse<ListUsersResponseBody>>, FilezError> {
    with_timing!(
                AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id]),
            AccessPolicyAction::UserGroupsListUsers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_users_query = UserGroup::list_users(
        &database,
        &user_group_id,
        request_body.from_index,
        request_body.limit,
        request_body.sort_by.as_deref(),
        request_body.sort_order,
    );

    let user_group_item_count_query = UserGroup::get_user_count(&database, &user_group_id);

    let (users, total_count): (Vec<FilezUser>, i64) = with_timing!(
        match tokio::join!(list_users_query, user_group_item_count_query) {
            (Ok(users), Ok(total_count)) => (users, total_count),
            (Err(e), _) => return Err(e.into()),
            (_, Err(e)) => return Err(e.into()),
        },
        "Database operations to list users and get user count",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got user list".to_string(),
        data: Some(ListUsersResponseBody { users, total_count }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListUsersRequestBody {
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListUsersResponseBody {
    pub users: Vec<FilezUser>,
    pub total_count: i64,
}
