use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        user_groups::UserGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/{user_group_id}/list_users",
    request_body = ListUsersRequestBody,
    responses(
        (status = 200, description = "Lists the users in a given group", body = ApiResponse<ListUsersResponseBody>),
    )
)]
pub async fn list_users(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<Uuid>,
    Json(req_body): Json<ListUsersRequestBody>,
) -> Result<Json<ApiResponse<ListUsersResponseBody>>, FilezError> {
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::UserGroup).unwrap(),
            Some(&vec![user_group_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::UserGroupListUsers).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let list_users_query = UserGroup::list_users(
        &db,
        &user_group_id,
        req_body.from_index,
        req_body.limit,
        req_body.sort_by.as_deref(),
        req_body.sort_order,
    );

    let user_group_item_count_query = UserGroup::get_user_count(&db, &user_group_id);

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
