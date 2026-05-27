use crate::validation::Json;
use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::user_groups::{ListUserGroupsFilter, UserGroup},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/user_groups/list",
    request_body = ListUserGroupsRequestBody,
    responses(
        (
            status = 200,
            description = "Listed user groups",
            body = ApiResponse<ListUserGroupsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_user_groups(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListUserGroupsRequestBody>,
) -> Result<Json<ApiResponse<ListUserGroupsResponseBody>>, FilezError> {
    // USER_GROUPS.md §6 — the default (None / AccessGranted) keeps
    // the pre-Phase-4 contract for callers that don't opt in.
    let filter = request_body
        .filter
        .unwrap_or(ListUserGroupsFilter::AccessGranted);

    // Anonymous callers only get the Public discovery mode. Every
    // other filter — including the default AccessGranted, which
    // resolves the requesting user's per-policy id set — needs a
    // user identity.
    if filter != ListUserGroupsFilter::Public
        && authentication_information.requesting_user.is_none()
    {
        return Err(FilezError::Unauthorized(format!(
            "Filter `{:?}` requires authentication",
            filter
        )));
    }

    // Exhaustive match: every ListUserGroupsFilter variant gets a
    // named arm. A new variant added to the enum triggers a compile
    // error here rather than silently routing through a wildcard
    // (phase4-review MAJ-2 / SLOP-10 / TECH-13).
    let (user_groups, total_count) = match filter {
        ListUserGroupsFilter::AccessGranted => with_timing!(
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
        ),
        ListUserGroupsFilter::Owned
        | ListUserGroupsFilter::Member
        | ListUserGroupsFilter::Invited
        | ListUserGroupsFilter::Requested
        | ListUserGroupsFilter::Public
        | ListUserGroupsFilter::ServerListed => with_timing!(
            UserGroup::list_with_filter(
                &database,
                authentication_information.requesting_user.as_ref(),
                filter,
                request_body.from_index,
                request_body.limit,
                request_body.sort_by,
                request_body.sort_order,
            )
            .await?,
            "Database operation to list user groups (filtered)",
            timing
        ),
    };

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User groups listed".to_string(),
        data: Some(ListUserGroupsResponseBody {
            user_groups,
            total_count,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
    /// USER_GROUPS.md §6 discovery filter. `None` (default) preserves
    /// the pre-Phase-4 behaviour: groups the caller has
    /// `UserGroupsList` policy on.
    pub filter: Option<ListUserGroupsFilter>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
    pub total_count: u64,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}
