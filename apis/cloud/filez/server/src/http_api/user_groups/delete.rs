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

    // USER_GROUPS.md §7.2 atomic cascade: drop subject-targeted
    // policies + remove the group row in ONE transaction. The
    // earlier shape ran the two writes via separate connections
    // and could partially succeed — see phase4-review CRIT-3.
    let dropped_policies = with_timing!(
        UserGroup::delete_one_with_subject_policy_cleanup(&database, &user_group_id).await?,
        "Database transaction: drop subject-targeted policies + delete user group",
        timing
    );
    // TODO(audit-log): replace this tracing event with a durable
    // audit_log row when Phase 5 lands the table. Tracing is
    // ephemeral / sampled in prod; for spec §7.2 ("the deletion is
    // logged in the audit table with the affected policy ids") we
    // need (event_type, actor_id, resource_id, ts, metadata jsonb).
    // phase4-review MAJ-7.
    tracing::info!(
        user_group_id = %user_group_id,
        dropped_policies,
        "USER_GROUPS.md §7.2: deleted group + dropped subject-targeted policies"
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: format!(
            "User group deleted ({} subject-targeted policies dropped)",
            dropped_policies
        ),
        data: Some(user_group_id.to_string()),
    }))
}
