use super::{
    access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    user_user_group_members::UserUserGroupMember,
    users::FilezUser,
};
use crate::{
    database::Database,
    errors::FilezError,
    http_api::user_groups::list::ListUserGroupsSortBy,
    impl_typed_uuid,
    models::{apps::MowsApp, users::FilezUserId},
    schema::{self},
    types::SortDirection,
    utils::get_current_timestamp,
};
use diesel::{
    pg::Pg, prelude::*, AsChangeset, ExpressionMethods, JoinOnDsl, QueryDsl, Selectable,
    SelectableHelper,
};

use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

impl_typed_uuid!(UserGroupId);

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable, AsChangeset,
)]
#[diesel(table_name = crate::schema::user_groups)]
#[diesel(check_for_backend(Pg))]
pub struct UserGroup {
    pub id: UserGroupId,
    pub owner_id: FilezUserId,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, ToSchema, Validate, AsChangeset, Clone, Debug)]
#[diesel(table_name = crate::schema::user_groups)]
pub struct UpdateUserGroupChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_user_group_name: Option<String>,
}

impl UserGroup {
    #[tracing::instrument(level = "trace")]
    fn new(owner: &FilezUser, name: &str) -> Self {
        Self {
            id: UserGroupId::new(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        owner: &FilezUser,
        name: &str,
    ) -> Result<UserGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let new_user_group = UserGroup::new(owner, name);
        let created_user_group = diesel::insert_into(schema::user_groups::table)
            .values(new_user_group)
            .returning(UserGroup::as_select())
            .get_result::<UserGroup>(&mut connection)
            .await?;
        Ok(created_user_group)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_id(
        database: &Database,
        user_group_ids: &Vec<UserGroupId>,
    ) -> Result<Vec<UserGroup>, FilezError> {
        let mut connection = database.get_connection().await?;
        let user_groups = schema::user_groups::table
            .filter(schema::user_groups::id.eq_any(user_group_ids))
            .select(UserGroup::as_select())
            .load::<UserGroup>(&mut connection)
            .await?;
        Ok(user_groups)
    }

    #[tracing::instrument(level = "trace", skip(database, maybe_requesting_user, requesting_app))]
    pub async fn list_with_user_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListUserGroupsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<UserGroup>, FilezError> {
        let mut connection = database.get_connection().await?;

        let resources_with_access = AccessPolicy::get_resources_with_access(
            database,
            maybe_requesting_user,
            requesting_app,
            AccessPolicyResourceType::UserGroup,
            AccessPolicyAction::UserGroupsList,
        )
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
            query = query.offset(from_index.try_into()?);
        }
        if let Some(limit) = limit {
            query = query.limit(limit.try_into()?);
        }

        let user_groups = query.load::<UserGroup>(&mut connection).await?;
        Ok(user_groups)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_one(
        database: &Database,
        user_group_id: &UserGroupId,
        changeset: &UpdateUserGroupChangeset,
    ) -> Result<UserGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let updated_user_group = diesel::update(schema::user_groups::table.find(user_group_id))
            .set((
                changeset,
                schema::user_groups::modified_time.eq(get_current_timestamp()),
            ))
            .returning(UserGroup::as_select())
            .get_result::<UserGroup>(&mut connection)
            .await?;
        Ok(updated_user_group)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::user_groups::table.filter(schema::user_groups::id.eq(user_group_id)),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn add_users(
        database: &Database,
        user_group_id: &UserGroupId,
        user_ids: &Vec<FilezUserId>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        let new_members = user_ids
            .iter()
            .map(|user_id| UserUserGroupMember::new(user_id, user_group_id))
            .collect::<Vec<UserUserGroupMember>>();

        diesel::insert_into(schema::user_user_group_members::table)
            .values(&new_members)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn remove_users(
        database: &Database,
        user_group_id: &UserGroupId,
        user_ids: &Vec<FilezUserId>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::user_user_group_members::table
                .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
                .filter(schema::user_user_group_members::user_id.eq_any(user_ids)),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    /// Retrieves all user group IDs that the specified user is a member of
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_all_ids_by_user_id(
        database: &Database,
        user_id: &FilezUserId,
    ) -> Result<Vec<UserGroupId>, FilezError> {
        let mut connection = database.get_connection().await?;

        let user_group_ids = schema::user_groups::table
            .inner_join(
                schema::user_user_group_members::table
                    .on(schema::user_groups::id.eq(schema::user_user_group_members::user_group_id)),
            )
            .filter(schema::user_user_group_members::user_id.eq(user_id))
            .select(schema::user_groups::id)
            .load::<UserGroupId>(&mut connection)
            .await?;

        Ok(user_group_ids)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_user_count(
        database: &Database,
        user_group_id: &UserGroupId,
    ) -> Result<u64, FilezError> {
        let mut connection = database.get_connection().await?;

        let count = schema::user_user_group_members::table
            .filter(schema::user_user_group_members::user_group_id.eq(user_group_id))
            .count()
            .get_result::<i64>(&mut connection)
            .await?;

        Ok(count.try_into()?)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_users(
        database: &Database,
        user_group_id: &UserGroupId,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<&str>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<FilezUser>, FilezError> {
        let mut connection = database.get_connection().await?;

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
            query = query.offset(from_index.try_into()?);
        }
        if let Some(limit) = limit {
            query = query.limit(limit.try_into()?);
        }

        let users_list = query.load::<FilezUser>(&mut connection).await?;

        Ok(users_list)
    }
}
