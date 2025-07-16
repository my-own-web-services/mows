use super::{
    access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    user_user_group_members::UserUserGroupMember,
    users::FilezUser,
};
use crate::{
    api::user_groups::list::ListUserGroupsSortBy,
    errors::FilezError,
    schema::{self},
    types::SortDirection,
    utils::get_uuid,
};
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    AsChangeset, ExpressionMethods, JoinOnDsl, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable, AsChangeset,
)]
#[diesel(table_name = crate::schema::user_groups)]
#[diesel(check_for_backend(Pg))]
pub struct UserGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl UserGroup {
    pub fn new(owner: &FilezUser, name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }

    pub async fn create(db: &crate::db::Db, user_group: &UserGroup) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::insert_into(schema::user_groups::table)
            .values(user_group)
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_by_id(
        db: &crate::db::Db,
        user_group_id: &Uuid,
    ) -> Result<UserGroup, FilezError> {
        let mut conn = db.pool.get().await?;
        let user_group = schema::user_groups::table
            .filter(schema::user_groups::id.eq(user_group_id))
            .select(UserGroup::as_select())
            .first::<UserGroup>(&mut conn)
            .await?;

        Ok(user_group)
    }

    pub async fn list_with_user_access(
        db: &crate::db::Db,
        requesting_user_id: &Uuid,
        app_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<ListUserGroupsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<UserGroup>, FilezError> {
        let mut conn = db.pool.get().await?;

        let resources_with_access = AccessPolicy::get_resources_with_access(
            db,
            requesting_user_id,
            app_id,
            AccessPolicyResourceType::UserGroup,
            AccessPolicyAction::UserGroupsList,
        )
        // box this
        .await?;

        let mut query = schema::user_groups::table
            .filter(schema::user_groups::id.eq_any(resources_with_access))
            .select(UserGroup::as_select())
            .into_boxed();

        let sort_by = sort_by.unwrap_or(ListUserGroupsSortBy::CreatedTime);
        let sort_order = sort_order.unwrap_or(SortDirection::Descending);

        match (sort_by, sort_order) {
            (ListUserGroupsSortBy::CreatedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::user_groups::created_time.asc());
            }
            (ListUserGroupsSortBy::CreatedTime, SortDirection::Descending) => {
                query = query.order_by(schema::user_groups::created_time.desc());
            }
            (ListUserGroupsSortBy::Name, SortDirection::Ascending) => {
                query = query.order_by(schema::user_groups::name.asc());
            }
            (ListUserGroupsSortBy::Name, SortDirection::Descending) => {
                query = query.order_by(schema::user_groups::name.desc());
            }
            (ListUserGroupsSortBy::ModifiedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::user_groups::modified_time.asc());
            }
            (ListUserGroupsSortBy::ModifiedTime, SortDirection::Descending) => {
                query = query.order_by(schema::user_groups::modified_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index);
        }
        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        let user_groups = query.load::<UserGroup>(&mut conn).await?;
        Ok(user_groups)
    }

    pub async fn update(
        db: &crate::db::Db,
        user_group_id: &Uuid,
        name: &str,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::update(
            schema::user_groups::table.filter(schema::user_groups::id.eq(user_group_id)),
        )
        .set((
            schema::user_groups::name.eq(name),
            schema::user_groups::modified_time.eq(chrono::Utc::now().naive_utc()),
        ))
        .execute(&mut conn)
        .await?;
        Ok(())
    }

    pub async fn delete(db: &crate::db::Db, user_group_id: &Uuid) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(
            schema::user_groups::table.filter(schema::user_groups::id.eq(user_group_id)),
        )
        .execute(&mut conn)
        .await?;
        Ok(())
    }

    pub async fn add_users(
        db: &crate::db::Db,
        user_group_id: &Uuid,
        user_ids: &Vec<Uuid>,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        let new_members = user_ids
            .iter()
            .map(|user_id| UserUserGroupMember::new(user_id, user_group_id))
            .collect::<Vec<UserUserGroupMember>>();

        diesel::insert_into(schema::user_user_group_members::table)
            .values(&new_members)
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn remove_users(
        db: &crate::db::Db,
        user_group_id: &Uuid,
        user_ids: &Vec<Uuid>,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(
            schema::user_user_group_members::table
                .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
                .filter(schema::user_user_group_members::user_id.eq_any(user_ids)),
        )
        .execute(&mut conn)
        .await?;
        Ok(())
    }

    /// Retrieves all user group IDs that the specified user is a member of
    pub async fn get_all_by_user_id(
        db: &crate::db::Db,
        user_id: &Uuid,
    ) -> Result<Vec<Uuid>, FilezError> {
        let mut conn = db.pool.get().await?;

        let user_groups = schema::user_groups::table
            .inner_join(
                schema::user_user_group_members::table
                    .on(schema::user_groups::id.eq(schema::user_user_group_members::user_group_id)),
            )
            .filter(schema::user_user_group_members::user_id.eq(user_id))
            .select(schema::user_groups::id)
            .load::<Uuid>(&mut conn)
            .await?;

        Ok(user_groups)
    }

    pub async fn get_user_count(
        db: &crate::db::Db,
        user_group_id: &Uuid,
    ) -> Result<i64, FilezError> {
        let mut conn = db.pool.get().await?;

        let count = schema::user_user_group_members::table
            .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
            .count()
            .get_result::<i64>(&mut conn)
            .await?;

        Ok(count)
    }

    pub async fn list_users(
        db: &crate::db::Db,
        user_group_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<&str>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<FilezUser>, FilezError> {
        let mut conn = db.pool.get().await?;

        let mut query = schema::user_groups::table
            .inner_join(
                schema::user_user_group_members::table
                    .on(schema::user_groups::id.eq(schema::user_user_group_members::user_group_id)),
            )
            .inner_join(
                schema::users::table
                    .on(schema::user_user_group_members::user_id.eq(schema::users::id)),
            )
            .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
            .select(FilezUser::as_select())
            .into_boxed();

        match (sort_by, sort_order) {
            (Some("created_time"), Some(SortDirection::Ascending)) => {
                query = query.order_by(schema::users::created_time.asc());
            }
            (Some("created_time"), Some(SortDirection::Descending)) => {
                query = query.order_by(schema::users::created_time.desc());
            }
            (Some("name"), Some(SortDirection::Ascending)) => {
                query = query.order_by(schema::users::display_name.asc());
            }
            (Some("name"), Some(SortDirection::Descending)) => {
                query = query.order_by(schema::users::display_name.desc());
            }
            _ => {
                query = query.order_by(schema::users::created_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index);
        }
        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        let users_list = query.load::<FilezUser>(&mut conn).await?;

        Ok(users_list)
    }
}
