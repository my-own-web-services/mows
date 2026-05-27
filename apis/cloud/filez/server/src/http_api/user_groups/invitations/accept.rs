//! POST /api/user_groups/{user_group_id}/invitations/accept
//!
//! The invitee accepts their pending invitation: deletes the
//! invitation row and inserts the membership row in a single
//! transaction. The invitee is identified by the authenticated
//! caller — no path param for user_id, deliberately, since only
//! the invitee can act on their own invitation.
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsRespondToInvite` on the
//! group. The default policy created at group setup grants this
//! action to "anyone with a row in user_user_group_invitations for
//! this group" — the existence of the invitation IS the consent.

use crate::{
    database::Database,
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroupId,
        user_user_group_invitations::UserUserGroupInvitation,
        user_user_group_members::UserUserGroupMember,
        users::FilezUserId,
    },
    schema,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::Json,
    with_timing,
};
use axum::{
    extract::{Path, State},
    Extension,
};
use diesel::{BoolExpressionMethods, ExpressionMethods, QueryDsl};
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};

#[utoipa::path(
    post,
    path = "/api/user_groups/{user_group_id}/invitations/accept",
    description = "Accept the caller's pending invitation to the group.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
    ),
    responses(
        (status = 200, description = "Invitation accepted; caller is now a member",
         body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "No pending invitation for the caller",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn accept_invitation(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(user_group_id): Path<UserGroupId>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsRespondToInvite,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let invitee = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| {
            FilezError::Unauthorized("Anonymous callers cannot accept invitations".to_string())
        })?;

    let pending = with_timing!(
        UserUserGroupInvitation::get_one(&database, &invitee.id, &user_group_id).await?,
        "Database operation to load pending invitation",
        timing
    );
    if pending.is_none() {
        return Err(FilezError::ResourceNotFound(
            "No pending invitation for this user/group".to_string(),
        ));
    }

    with_timing!(
        accept_in_transaction(&database, &user_group_id, &invitee.id).await?,
        "Database transaction: delete invitation + insert member",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Invitation accepted".to_string(),
        data: None,
    }))
}

#[tracing::instrument(skip(database), level = "trace")]
async fn accept_in_transaction(
    database: &Database,
    user_group_id: &UserGroupId,
    user_id: &FilezUserId,
) -> Result<(), FilezError> {
    let mut connection = database.get_connection().await?;
    connection
        .transaction::<(), FilezError, _>(|conn| {
            async move {
                let affected = diesel::delete(
                    schema::user_user_group_invitations::table.filter(
                        schema::user_user_group_invitations::user_id
                            .eq(user_id)
                            .and(
                                schema::user_user_group_invitations::user_group_id
                                    .eq(user_group_id),
                            ),
                    ),
                )
                .execute(conn)
                .await?;
                if affected == 0 {
                    return Err(FilezError::ResourceNotFound(
                        "Invitation already resolved".to_string(),
                    ));
                }
                diesel::insert_into(schema::user_user_group_members::table)
                    .values(UserUserGroupMember::new(user_id, user_group_id))
                    .on_conflict_do_nothing()
                    .execute(conn)
                    .await?;
                Ok(())
            }
            .scope_boxed()
        })
        .await
}
