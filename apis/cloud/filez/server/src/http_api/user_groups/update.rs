use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroup,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/user_groups/update",
    request_body = UpdateUserGroupRequestBody,
    responses(
        (status = 200, description = "Updates a user group", body = ApiResponse<UserGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateUserGroupRequestBody>,
) -> Result<Json<ApiResponse<UserGroup>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_group_id]),
            AccessPolicyAction::UserGroupsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        UserGroup::update(&database, &request_body.user_group_id, &request_body.name).await?,
        "Database operation to update user group",
        timing
    );

    let user_group = with_timing!(
        UserGroup::get_by_id(&database, &request_body.user_group_id).await?,
        "Database operation to get updated user group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group updated".to_string(),
        data: Some(user_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateUserGroupRequestBody {
    pub user_group_id: Uuid,
    pub name: String,
}
