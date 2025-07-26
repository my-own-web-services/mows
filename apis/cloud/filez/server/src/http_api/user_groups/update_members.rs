use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
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
    post,
    path = "/api/user_groups/update_members",
    request_body = UpdateUserGroupMembersRequestBody,
    responses(
        (status = 200, description = "Updates the members of a user group", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_user_group_members(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateUserGroupMembersRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![request_body.user_group_id]),
            AccessPolicyAction::UserGroupsUpdateMembers,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    if let Some(users_to_add) = request_body.users_to_add {
        with_timing!(
            UserGroup::add_users(&database, &request_body.user_group_id, &users_to_add).await?,
            "Database operation to add users to user group",
            timing
        );
    }

    if let Some(users_to_remove) = request_body.users_to_remove {
        with_timing!(
            UserGroup::remove_users(&database, &request_body.user_group_id, &users_to_remove).await?,
            "Database operation to remove users from user group",
            timing
        );
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group members updated".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: Uuid,
    pub users_to_add: Option<Vec<Uuid>>,
    pub users_to_remove: Option<Vec<Uuid>>,
}
