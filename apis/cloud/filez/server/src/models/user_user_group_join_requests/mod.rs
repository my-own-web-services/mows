//! Pending "I want to join this group" requests.
//!
//! Populated by `POST /user-groups/{id}/join-requests` against a
//! `RequestToJoin` group (USER_GROUPS.md §6). The row stays pending
//! until the owner approves or rejects, at which point it is
//! removed — approval also inserts a `user_user_group_members` row
//! in the same transaction.
//!
//! PK is `(user_id, user_group_id)` so a duplicate request from the
//! same user is a no-op (ON CONFLICT DO NOTHING).

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    BoolExpressionMethods, ExpressionMethods, OptionalExtension, QueryDsl, Selectable,
    SelectableHelper,
};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    database::Database,
    errors::FilezError,
    models::{user_groups::UserGroupId, users::FilezUserId},
    schema,
    utils::get_current_timestamp,
};

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug,
)]
#[diesel(table_name = schema::user_user_group_join_requests)]
#[diesel(check_for_backend(Pg))]
pub struct UserUserGroupJoinRequest {
    pub user_id: FilezUserId,
    pub user_group_id: UserGroupId,
    pub requested_time: chrono::NaiveDateTime,
    pub message: Option<String>,
}

impl UserUserGroupJoinRequest {
    pub fn new(
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
        message: Option<String>,
    ) -> Self {
        Self {
            user_id: user_id.clone(),
            user_group_id: user_group_id.clone(),
            requested_time: get_current_timestamp(),
            message,
        }
    }

    /// Insert idempotently. A duplicate request from the same user
    /// is a no-op (per USER_GROUPS.md §7 edge cases).
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
        message: Option<String>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        let row = Self::new(user_id, user_group_id, message);
        diesel::insert_into(schema::user_user_group_join_requests::table)
            .values(row)
            .on_conflict_do_nothing()
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one(
        database: &Database,
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
    ) -> Result<Option<UserUserGroupJoinRequest>, FilezError> {
        let mut connection = database.get_connection().await?;
        let row = schema::user_user_group_join_requests::table
            .filter(
                schema::user_user_group_join_requests::user_id
                    .eq(user_id)
                    .and(schema::user_user_group_join_requests::user_group_id.eq(user_group_id)),
            )
            .select(UserUserGroupJoinRequest::as_select())
            .first::<UserUserGroupJoinRequest>(&mut connection)
            .await
            .optional()?;
        Ok(row)
    }

    /// Delete the pending request. Used by both approve (after the
    /// member insert succeeds) and reject. Idempotent.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(
        database: &Database,
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::user_user_group_join_requests::table.filter(
                schema::user_user_group_join_requests::user_id
                    .eq(user_id)
                    .and(schema::user_user_group_join_requests::user_group_id.eq(user_group_id)),
            ),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    /// List pending requests for a group — owner-facing dashboard.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_user_group(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<Vec<UserUserGroupJoinRequest>, FilezError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::user_user_group_join_requests::table
            .filter(schema::user_user_group_join_requests::user_group_id.eq(user_group_id))
            .select(UserUserGroupJoinRequest::as_select())
            .load::<UserUserGroupJoinRequest>(&mut connection)
            .await?;
        Ok(rows)
    }

    /// List pending requests by a user — user's own dashboard.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_user(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<Vec<UserUserGroupJoinRequest>, FilezError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::user_user_group_join_requests::table
            .filter(schema::user_user_group_join_requests::user_id.eq(user_id))
            .select(UserUserGroupJoinRequest::as_select())
            .load::<UserUserGroupJoinRequest>(&mut connection)
            .await?;
        Ok(rows)
    }
}
