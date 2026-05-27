//! Pending "you're invited to join this group" invitations.
//!
//! Populated by `POST /user-groups/{id}/invitations` by group owners
//! against `InviteOnly` or `RequestToJoin` groups (USER_GROUPS.md
//! §6). The row stays pending until the invitee accepts or declines.
//! Acceptance also inserts a `user_user_group_members` row in the
//! same transaction.

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
#[diesel(table_name = schema::user_user_group_invitations)]
#[diesel(check_for_backend(Pg))]
pub struct UserUserGroupInvitation {
    pub user_id: FilezUserId,
    pub user_group_id: UserGroupId,
    pub invited_time: chrono::NaiveDateTime,
    /// `None` after the inviter's account is deleted
    /// (USER_GROUPS.md §7.4 — "the invitation is irrelevant but
    /// harmless. Leave it"). FK is `ON DELETE SET NULL` per
    /// migration 00000000000013.
    pub invited_by: Option<FilezUserId>,
    pub message: Option<String>,
}

impl UserUserGroupInvitation {
    // Crate-internal — external callers must go through
    // `create_one` so the row is persisted under the
    // ON CONFLICT DO NOTHING idempotency contract
    // (phase4-review MIN-4 / TECH-12).
    pub(crate) fn new(
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
        invited_by: &FilezUserId,
        message: Option<String>,
    ) -> Self {
        Self {
            user_id: user_id.clone(),
            user_group_id: user_group_id.clone(),
            invited_time: get_current_timestamp(),
            invited_by: Some(invited_by.clone()),
            message,
        }
    }

    /// Insert idempotently. Re-inviting the same user is a no-op
    /// (USER_GROUPS.md §7).
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
        invited_by: &FilezUserId,
        message: Option<String>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        let row = Self::new(user_id, user_group_id, invited_by, message);
        diesel::insert_into(schema::user_user_group_invitations::table)
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
    ) -> Result<Option<UserUserGroupInvitation>, FilezError> {
        let mut connection = database.get_connection().await?;
        let row = schema::user_user_group_invitations::table
            .filter(
                schema::user_user_group_invitations::user_id
                    .eq(user_id)
                    .and(schema::user_user_group_invitations::user_group_id.eq(user_group_id)),
            )
            .select(UserUserGroupInvitation::as_select())
            .first::<UserUserGroupInvitation>(&mut connection)
            .await
            .optional()?;
        Ok(row)
    }

    /// Delete the pending invitation. Used by both accept (after the
    /// member insert) and decline. Idempotent.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(
        database: &Database,
        user_id: &FilezUserId,
        user_group_id: &UserGroupId,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::user_user_group_invitations::table.filter(
                schema::user_user_group_invitations::user_id
                    .eq(user_id)
                    .and(schema::user_user_group_invitations::user_group_id.eq(user_group_id)),
            ),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    /// List pending invitations for a group — owner-facing
    /// dashboard.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_user_group(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<Vec<UserUserGroupInvitation>, FilezError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::user_user_group_invitations::table
            .filter(schema::user_user_group_invitations::user_group_id.eq(user_group_id))
            .select(UserUserGroupInvitation::as_select())
            .load::<UserUserGroupInvitation>(&mut connection)
            .await?;
        Ok(rows)
    }

    /// List pending invitations for a user — invitee dashboard.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_user(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<Vec<UserUserGroupInvitation>, FilezError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::user_user_group_invitations::table
            .filter(schema::user_user_group_invitations::user_id.eq(user_id))
            .select(UserUserGroupInvitation::as_select())
            .load::<UserUserGroupInvitation>(&mut connection)
            .await?;
        Ok(rows)
    }
}
