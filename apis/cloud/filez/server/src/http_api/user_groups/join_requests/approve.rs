//! POST /api/user_groups/{user_group_id}/join_requests/{user_id}/approve
//!
//! Owner approves a pending join request: deletes the request row and
//! inserts the membership row in a single transaction. Idempotent —
//! if the request is gone (already approved/rejected), returns 404.
//!
//! USER_GROUPS.md §6 — gated by `UserGroupsApprove` on the group.

use crate::{
    database::Database,
    errors::{AuthResultExt, FilezError},
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        user_groups::UserGroupId,
        user_user_group_join_requests::UserUserGroupJoinRequest,
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
    path = "/api/user_groups/{user_group_id}/join_requests/{user_id}/approve",
    description = "Approve a pending join request; inserts the membership row in one transaction.",
    params(
        ("user_group_id" = UserGroupId, Path, description = "Target user group"),
        ("user_id"       = FilezUserId, Path, description = "User whose request is being approved"),
    ),
    responses(
        (status = 200, description = "Request approved; user is now a member",
         body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "No pending request for that (user, group)",
         body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error",
         body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn approve_join_request(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path((user_group_id, user_id)): Path<(UserGroupId, FilezUserId)>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::UserGroup,
            Some(&vec![user_group_id.into()]),
            AccessPolicyAction::UserGroupsApprove,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    // The pending request must exist, otherwise 404. Reading it
    // outside the transaction is fine — the transaction below
    // re-checks via the DELETE's affected-row count.
    let pending = with_timing!(
        UserUserGroupJoinRequest::get_one(&database, &user_id, &user_group_id).await?,
        "Database operation to load pending join request",
        timing
    );
    if pending.is_none() {
        return Err(FilezError::ResourceNotFound(
            "No pending join request for that (user, group)".to_string(),
        ));
    }

    // Atomic move: DELETE the request row + INSERT the member row.
    // The DELETE's affected count guards against a concurrent
    // approve/reject — second writer's DELETE returns 0 and we bail.
    with_timing!(
        approve_in_transaction(&database, &user_group_id, &user_id).await?,
        "Database transaction: delete request + insert member",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Join request approved".to_string(),
        data: None,
    }))
}

#[tracing::instrument(skip(database), level = "trace")]
async fn approve_in_transaction(
    database: &Database,
    user_group_id: &UserGroupId,
    user_id: &FilezUserId,
) -> Result<(), FilezError> {
    let mut connection = database.get_connection().await?;
    connection
        .transaction::<(), FilezError, _>(|conn| {
            async move {
                let affected = diesel::delete(
                    schema::user_user_group_join_requests::table.filter(
                        schema::user_user_group_join_requests::user_id
                            .eq(user_id)
                            .and(
                                schema::user_user_group_join_requests::user_group_id
                                    .eq(user_group_id),
                            ),
                    ),
                )
                .execute(conn)
                .await?;
                if affected == 0 {
                    // Lost the race with another approve/reject.
                    return Err(FilezError::ResourceNotFound(
                        "Join request already resolved".to_string(),
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
