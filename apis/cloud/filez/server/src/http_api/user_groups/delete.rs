use axum::{
    extract::{Path, State},
    Extension, Json,
};

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
    delete,
    path = "/api/user_groups/delete/{user_group_id}",
    description = "Delete a user group by its ID",
    params(
        (
            "user_group_id" = Uuid,
            Path,
            description = "The ID of the user group to delete"
        ),
    ),
    responses(
        (
            status = 200,
            description = "Deleted the user group",
            body = ApiResponse<String>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn delete_user_group(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
) -> Result<Json<ApiResponse<String>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        UserGroup::delete_one(&database, &user_group_id).await?,
        "Database operation to delete user group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "User group deleted".to_string(),
        data: Some(user_group_id.to_string()),
    }))
}
