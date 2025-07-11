use crate::{
    api::file_groups::{
        list::ListFileGroupsSortBy,
        list_files::{ListFilesSortBy, ListFilesSorting},
    },
    errors::FilezError,
    schema,
    types::SortDirection,
    utils::{get_uuid, InvalidEnumType},
};
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{Insertable, Queryable},
    sql_types::SmallInt,
    AsChangeset, ExpressionMethods, JoinOnDsl, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::{
    access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    files::FilezFile,
    users::FilezUser,
};

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug, AsChangeset,
)]
#[diesel(table_name = crate::schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct FileGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    #[diesel(sql_type = diesel::sql_types::SmallInt)]
    pub group_type: FileGroupType,
}

#[derive(
    Debug,
    Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum FileGroupType {
    Manual = 0,
    Dynamic = 1,
}

impl FileGroup {
    pub fn new(owner: &FilezUser, name: &str, group_type: FileGroupType) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            group_type,
        }
    }

    pub async fn create(db: &crate::db::Db, file_group: &FileGroup) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::insert_into(schema::file_groups::table)
            .values(file_group)
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_by_id(db: &crate::db::Db, id: &Uuid) -> Result<FileGroup, FilezError> {
        let mut conn = db.pool.get().await?;
        let file_group = schema::file_groups::table
            .filter(schema::file_groups::id.eq(id))
            .select(FileGroup::as_select())
            .get_result::<FileGroup>(&mut conn)
            .await?;
        Ok(file_group)
    }

    pub async fn list_with_user_access(
        db: &crate::db::Db,
        requesting_user_id: &Uuid,
        app_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<ListFileGroupsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<FileGroup>, FilezError> {
        let mut conn = db.pool.get().await?;

        let resources_with_access = AccessPolicy::get_resources_with_access(
            db,
            requesting_user_id,
            app_id,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupList).unwrap(),
        )
        .await?;

        let mut query = schema::file_groups::table
            .filter(schema::file_groups::id.eq_any(resources_with_access))
            .select(FileGroup::as_select())
            .into_boxed();

        let sort_by = sort_by.unwrap_or(ListFileGroupsSortBy::CreatedTime);
        let sort_order = sort_order.unwrap_or(SortDirection::Descending);

        match (sort_by, sort_order) {
            (ListFileGroupsSortBy::Name, SortDirection::Ascending) => {
                query = query.order_by(schema::file_groups::name.asc());
            }
            (ListFileGroupsSortBy::Name, SortDirection::Descending) => {
                query = query.order_by(schema::file_groups::name.desc());
            }
            (ListFileGroupsSortBy::CreatedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::file_groups::created_time.asc());
            }
            (ListFileGroupsSortBy::CreatedTime, SortDirection::Descending) => {
                query = query.order_by(schema::file_groups::created_time.desc());
            }
            (ListFileGroupsSortBy::ModifiedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::file_groups::modified_time.asc());
            }
            (ListFileGroupsSortBy::ModifiedTime, SortDirection::Descending) => {
                query = query.order_by(schema::file_groups::modified_time.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index);
        }
        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        let file_groups = query.load::<FileGroup>(&mut conn).await?;
        Ok(file_groups)
    }

    pub async fn update(
        db: &crate::db::Db,
        file_group_id: &Uuid,
        name: &str,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::update(schema::file_groups::table.find(file_group_id))
            .set((
                schema::file_groups::name.eq(name),
                schema::file_groups::modified_time.eq(chrono::Utc::now().naive_utc()),
            ))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn delete(db: &crate::db::Db, file_group_id: &Uuid) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(schema::file_groups::table.find(file_group_id))
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_file_count(
        db: &crate::db::Db,
        file_group_id: &Uuid,
    ) -> Result<i64, FilezError> {
        let mut conn = db.pool.get().await?;

        let count = schema::file_file_group_members::table
            .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
            .count()
            .get_result::<i64>(&mut conn)
            .await?;

        Ok(count)
    }

    pub async fn list_files(
        db: &crate::db::Db,
        file_group_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort: Option<ListFilesSorting>,
    ) -> Result<Vec<FilezFile>, FilezError> {
        let mut conn = db.pool.get().await?;
        match sort {
            Some(ListFilesSorting::StoredSortOrder(stored_sort_order)) => {
                let sort_direction = stored_sort_order
                    .sort_order
                    .unwrap_or(SortDirection::Descending);
                let sort_order_id = stored_sort_order.id;

                let mut query = schema::file_group_file_sort_order_items::table
                    .inner_join(schema::files::table.on(
                        schema::file_group_file_sort_order_items::file_id.eq(schema::files::id),
                    ))
                    .inner_join(
                        schema::file_group_file_sort_orders::table
                            .on(schema::file_group_file_sort_order_items::sort_order_id
                                .eq(schema::file_group_file_sort_orders::id)),
                    )
                    .filter(schema::file_group_file_sort_orders::file_group_id.eq(file_group_id))
                    .filter(schema::file_group_file_sort_orders::id.eq(sort_order_id))
                    .select(FilezFile::as_select())
                    .into_boxed();

                match sort_direction {
                    SortDirection::Ascending => {
                        query = query
                            .order_by(schema::file_group_file_sort_order_items::position.asc());
                    }
                    SortDirection::Descending => {
                        query = query
                            .order_by(schema::file_group_file_sort_order_items::position.desc());
                    }
                }
                if let Some(from_index) = from_index {
                    query = query.offset(from_index);
                }
                if let Some(limit) = limit {
                    query = query.limit(limit);
                }

                let files_list = query.load::<FilezFile>(&mut conn).await?;

                Ok(files_list)
            }
            Some(ListFilesSorting::SortOrder(sort)) => {
                let mut query = schema::file_file_group_members::table
                    .inner_join(
                        schema::files::table
                            .on(schema::file_file_group_members::file_id.eq(schema::files::id)),
                    )
                    .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
                    .select(FilezFile::as_select())
                    .into_boxed();

                let sort_direction = sort.sort_order.unwrap_or(SortDirection::Descending);
                match (sort.sort_by, sort_direction) {
                    (ListFilesSortBy::Name, SortDirection::Ascending) => {
                        query = query.order_by(schema::files::name.asc());
                    }
                    (ListFilesSortBy::Name, SortDirection::Descending) => {
                        query = query.order_by(schema::files::name.desc());
                    }
                    (ListFilesSortBy::CreatedTime, SortDirection::Ascending) => {
                        query = query.order_by(schema::files::created_time.asc());
                    }
                    (ListFilesSortBy::CreatedTime, SortDirection::Descending) => {
                        query = query.order_by(schema::files::created_time.desc());
                    }
                    (ListFilesSortBy::ModifiedTime, SortDirection::Ascending) => {
                        query = query.order_by(schema::files::modified_time.asc());
                    }
                    (ListFilesSortBy::ModifiedTime, SortDirection::Descending) => {
                        query = query.order_by(schema::files::modified_time.desc());
                    }
                }
                if let Some(from_index) = from_index {
                    query = query.offset(from_index);
                }
                if let Some(limit) = limit {
                    query = query.limit(limit);
                }

                let files_list = query.load::<FilezFile>(&mut conn).await?;

                Ok(files_list)
            }
            None => {
                let mut query = schema::file_file_group_members::table
                    .inner_join(
                        schema::files::table
                            .on(schema::file_file_group_members::file_id.eq(schema::files::id)),
                    )
                    .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
                    .select(FilezFile::as_select())
                    .into_boxed();
                query = query.order_by(schema::files::created_time.desc());

                if let Some(from_index) = from_index {
                    query = query.offset(from_index);
                }
                if let Some(limit) = limit {
                    query = query.limit(limit);
                }

                let files_list = query.load::<FilezFile>(&mut conn).await?;

                Ok(files_list)
            }
        }
    }
}
