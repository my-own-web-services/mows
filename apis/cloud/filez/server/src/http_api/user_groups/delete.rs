use crate::errors::AuthResultExt;

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

    // USER_GROUPS.md §7.2: drop every access_policies row whose
    // subject was this group BEFORE removing the group row itself.
    // Order matters for the audit log entry — the dropped count is
    // captured here while the group still exists, so a future audit
    // hook can attribute "N policies revoked due to deletion of group
    // <id>".
    let dropped_policies = with_timing!(
        AccessPolicy::delete_all_by_subject(
            &database,
            mows_auth_core::types::SubjectType::UserGroup,
            &user_group_id.into(),
        )
        .await?,
        "Database operation to drop subject-targeted policies",
        timing
    );
    tracing::info!(
        user_group_id = %user_group_id,
        dropped_policies,
        "USER_GROUPS.md §7.2: dropped group-subject access policies prior to group delete"
    );

    with_timing!(
        UserGroup::delete_one(&database, &user_group_id).await?,
        "Database operation to delete user group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!(
            "User group deleted ({} subject-targeted policies dropped)",
            dropped_policies
        ),
        data: Some(user_group_id.to_string()),
    }))
}
