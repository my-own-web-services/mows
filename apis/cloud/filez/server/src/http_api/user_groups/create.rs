use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

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
    path = "/api/user_groups/create",
    request_body = CreateUserGroupRequestBody,
    responses(
        (status = 200, description = "Creates a new user group", body = ApiResponse<UserGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn create_user_group(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateUserGroupRequestBody>,
) -> Result<Json<ApiResponse<UserGroup>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::UserGroup,
            None,
            AccessPolicyAction::UserGroupsCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let user_group = with_timing!(
        UserGroup::new(&requesting_user, &request_body.name),
        "Creating new user group",
        timing
    );

    with_timing!(
        UserGroup::create(&database, &user_group).await?,
        "Database operation to create user group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group created".to_string(),
        data: Some(user_group),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateUserGroupRequestBody {
    pub name: String,
}
