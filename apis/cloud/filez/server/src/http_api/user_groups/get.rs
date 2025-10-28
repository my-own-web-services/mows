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
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/user_groups/get",
    description = "Get user groups by their IDs",
    request_body = GetUserGroupsRequestBody,
    responses(
        (
            status = 200,
            description = "Got the user groups",
            body = ApiResponse<GetUserGroupsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_user_groups(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetUserGroupsRequestBody>,
) -> Result<Json<ApiResponse<GetUserGroupsResponseBody>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(
                &request_body
                    .user_group_ids
                    .clone()
                    .into_iter()
                    .map(|id| id.into())
                    .collect::<Vec<_>>()
            ),
            AccessPolicyAction::UserGroupsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let user_groups = with_timing!(
        UserGroup::get_many_by_id(&database, &request_body.user_group_ids).await?,
        "Database operation to get user group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group retrieved".to_string(),
        data: Some(GetUserGroupsResponseBody { user_groups }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetUserGroupsRequestBody {
    /// The IDs of the user groups to retrieve
    pub user_group_ids: Vec<UserGroupId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetUserGroupsResponseBody {
    /// The retrieved user groups
    pub user_groups: Vec<UserGroup>,
}
