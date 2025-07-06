use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_groups::FileGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/file_groups/list",
    request_body = ListFileGroupsRequestBody,
    responses(
        (status = 200, description = "Lists file groups", body = ApiResponse<ListFileGroupsResponseBody>),
    )
)]
pub async fn list_file_groups(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListFileGroupsRequestBody>,
) -> Result<Json<ApiResponse<ListFileGroupsResponseBody>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_by_external_id(&db, &external_user.user_id).await?,
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
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            None,
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupList).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

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
