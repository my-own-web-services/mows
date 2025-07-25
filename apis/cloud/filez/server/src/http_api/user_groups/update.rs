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
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/user_groups/{user_group_id}",
    request_body = UpdateUserGroupRequestBody,
    responses(
        (status = 200, description = "Updates a user group", body = ApiResponse<UserGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_user_group(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<Uuid>,
    Json(request_body): Json<UpdateUserGroupRequestBody>,
) -> Result<Json<ApiResponse<UserGroup>>, FilezError> {
    with_timing!(
                AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id]),
            AccessPolicyAction::UserGroupsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        UserGroup::update(&database, &user_group_id, &request_body.name).await?,
        "Database operation to update user group",
        timing
    );

    let user_group = with_timing!(
        UserGroup::get_by_id(&database, &user_group_id).await?,
        "Database operation to get updated user group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group updated".to_string(),
        data: Some(user_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateUserGroupRequestBody {
    pub name: String,
}
