use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::{UserGroup, UserGroupId},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/list_users",
    description = "List users in a user group by the user group ID",
    request_body = ListUsersRequestBody,
    responses(
        (
            status = 200,
            description = "Listed the users in the given group",
            body = ApiResponse<ListUsersResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_users_by_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUsersRequestBody>,
) -> Result<Json<ApiResponse<ListUsersResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_group_id.into()]),
            AccessPolicyAction::UserGroupsListUsers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_users_query = UserGroup::list_users(
        &database,
        &request_body.user_group_id,
        request_body.from_index,
        request_body.limit,
        request_body.sort_by.as_deref(),
        request_body.sort_order,
    );

    let user_group_item_count_query =
        UserGroup::get_user_count(&database, &request_body.user_group_id);

    let (users, total_count): (Vec<FilezUser>, u64) = with_timing!(
        match tokio::join!(list_users_query, user_group_item_count_query) {
            (Ok(users), Ok(total_count)) => (users, total_count),
            (Err(e), _) => return Err(e.into()),
            (_, Err(e)) => return Err(e.into()),
        },
        "Database operations to list users and get user count",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Got user list".to_string(),
        data: Some(ListUsersResponseBody { users, total_count }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListUsersRequestBody {
    pub user_group_id: UserGroupId,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListUsersResponseBody {
    pub users: Vec<FilezUser>,
    pub total_count: u64,
}
