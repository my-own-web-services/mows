use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        user_groups::UserGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/user_groups/list",
    request_body = ListUserGroupsRequestBody,
    responses(
        (status = 200, description = "Lists user groups", body = ApiResponse<ListUserGroupsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_user_groups(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUserGroupsRequestBody>,
) -> Result<Json<ApiResponse<ListUserGroupsResponseBody>>, FilezError> {
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
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::UserGroup,
            None,
            AccessPolicyAction::UserGroupsList,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let user_groups = with_timing!(
        UserGroup::list_with_user_access(
            &db,
            &requesting_user.id,
            &requesting_app.id,
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
        status: ApiResponseStatus::Success,
        message: "User groups listed".to_string(),
        data: Some(ListUserGroupsResponseBody { user_groups }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<i64>,
    pub limit: Option<i64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}
