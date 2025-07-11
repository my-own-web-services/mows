use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        users::{FilezUser, ListedFilezUser},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/users/list",
    request_body = ListUsersRequestBody,
    responses(
        (status = 200, description = "Lists all Users", body = ApiResponse<ListUsersResponseBody>),
    )
)]
pub async fn list_users(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUsersRequestBody>,
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::User).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::UsersList).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let users = with_timing!(
        FilezUser::list_with_user_access(
            &db,
            &requesting_user.id,
            &requesting_app.id,
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
