pub mod errors;

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    query_dsl::methods::{FindDsl, SelectDsl},
    AsChangeset, ExpressionMethods, JoinOnDsl, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use errors::UserGroupError;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{schema, types::SortDirection, utils::get_uuid};

use super::users::FilezUser;

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

    pub async fn create(db: &crate::db::Db, user_group: &UserGroup) -> Result<(), UserGroupError> {
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
    ) -> Result<UserGroup, UserGroupError> {
        let mut conn = db.pool.get().await?;
        let user_group = SelectDsl::select(
            QueryDsl::filter(
                schema::user_groups::table,
                schema::user_groups::id.eq(user_group_id),
            ),
            UserGroup::as_select(),
        )
        .get_result::<UserGroup>(&mut conn)
        .await?;
        Ok(user_group)
    }

    pub async fn list(
        db: &crate::db::Db,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<&str>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<UserGroup>, UserGroupError> {
        let mut conn = db.pool.get().await?;
        let mut query =
            SelectDsl::select(schema::user_groups::table, UserGroup::as_select()).into_boxed();

        match (sort_by, sort_order) {
            (Some("created_time"), Some(SortDirection::Ascending)) => {
                query = query.order_by(schema::user_groups::created_time.asc());
            }
            (Some("created_time"), Some(SortDirection::Descending)) => {
                query = query.order_by(schema::user_groups::created_time.desc());
            }
            (Some("name"), Some(SortDirection::Ascending)) => {
                query = query.order_by(schema::user_groups::name.asc());
            }
            (Some("name"), Some(SortDirection::Descending)) => {
                query = query.order_by(schema::user_groups::name.desc());
            }
            _ => {
                query = query.order_by(schema::user_groups::created_time.desc());
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
    ) -> Result<(), UserGroupError> {
        let mut conn = db.pool.get().await?;
        diesel::update(FindDsl::find(schema::user_groups::table, user_group_id))
            .set((
                schema::user_groups::name.eq(name),
                schema::user_groups::modified_time.eq(chrono::Utc::now().naive_utc()),
            ))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn delete(db: &crate::db::Db, user_group_id: &Uuid) -> Result<(), UserGroupError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(FindDsl::find(schema::user_groups::table, user_group_id))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_all_by_user_id(
        db: &crate::db::Db,
        user_id: &Uuid,
    ) -> Result<Vec<Uuid>, UserGroupError> {
        let mut conn = db.pool.get().await?;

        let user_groups = SelectDsl::select(
            QueryDsl::filter(
                schema::user_user_group_members::table,
                schema::user_user_group_members::user_id.eq(user_id),
            ),
            schema::user_user_group_members::user_group_id,
        )
        .load::<Uuid>(&mut conn)
        .await?;

        Ok(user_groups)
    }

    pub async fn get_user_count(
        db: &crate::db::Db,
        user_group_id: &Uuid,
    ) -> Result<i64, UserGroupError> {
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
    ) -> Result<Vec<FilezUser>, UserGroupError> {
        let mut conn = db.pool.get().await?;

        let mut query = SelectDsl::select(
            schema::user_user_group_members::table
                .inner_join(
                    schema::users::table
                        .on(schema::user_user_group_members::user_id.eq(schema::users::id)),
                )
                .filter(schema::user_user_group_members::user_group_id.eq(user_group_id)),
            FilezUser::as_select(),
        )
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
