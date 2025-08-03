use axum::{
    extract::{Path, State},
    Extension, Json,
};
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
    get,
    path = "/api/user_groups/get/{user_group_id}",
    params(
        ("user_group_id" = Uuid, Path, description = "The ID of the user group to retrieve"),
    ),
    responses(
        (status = 200, description = "Gets a user group by ID", body = ApiResponse<UserGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<Uuid>,
) -> Result<Json<ApiResponse<UserGroup>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id]),
            AccessPolicyAction::UserGroupsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let user_group = with_timing!(
        UserGroup::get_by_id(&database, &user_group_id).await?,
        "Database operation to get user group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "User group retrieved".to_string(),
        data: Some(user_group),
    }))
}
