use crate::{
    database::Database,
    errors::FilezError,
    http_api::file_groups::{
        list::ListFileGroupsSortBy,
        list_files::{ListFilesSortBy, ListFilesSorting},
    },
    models::apps::MowsApp,
    schema,
    types::SortDirection,
    utils::{get_current_timestamp, get_uuid, InvalidEnumType},
};
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{Insertable, Queryable},
    sql_types::SmallInt,
    AsChangeset, ExpressionMethods, JoinOnDsl, QueryDsl, Selectable, SelectableHelper,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::{
    access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    file_file_group_members::FileFileGroupMember,
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
    pub group_type: FileGroupType,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq, AsJsonb)]
pub struct DynamicGroupRule {}

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
    pub fn new(
        owner: &FilezUser,
        name: &str,
        group_type: FileGroupType,
        dynamic_group_rule: Option<DynamicGroupRule>,
    ) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            group_type,
            dynamic_group_rule,
        }
    }

    pub async fn create(database: &Database, file_group: &FileGroup) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::insert_into(schema::file_groups::table)
            .values(file_group)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn get_by_id(database: &Database, id: &Uuid) -> Result<FileGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let file_group = schema::file_groups::table
            .filter(schema::file_groups::id.eq(id))
            .select(FileGroup::as_select())
            .get_result::<FileGroup>(&mut connection)
            .await?;
        Ok(file_group)
    }

    pub async fn list_with_user_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListFileGroupsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<FileGroup>, FilezError> {
        let mut connection = database.get_connection().await?;

        let resources_with_access = AccessPolicy::get_resources_with_access(
            database,
            maybe_requesting_user,
            requesting_app,
            AccessPolicyResourceType::FileGroup,
            AccessPolicyAction::FileGroupsList,
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
            query = query.offset(from_index.try_into()?);
        }
        if let Some(limit) = limit {
            query = query.limit(limit.try_into()?);
        }

        let file_groups = query.load::<FileGroup>(&mut connection).await?;
        Ok(file_groups)
    }

    pub async fn update(
        database: &Database,
        file_group_id: &Uuid,
        name: &str,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::update(schema::file_groups::table.find(file_group_id))
            .set((
                schema::file_groups::name.eq(name),
                schema::file_groups::modified_time.eq(get_current_timestamp()),
            ))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn delete(database: &Database, file_group_id: &Uuid) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(schema::file_groups::table.find(file_group_id))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn get_file_count(
        database: &Database,
        file_group_id: &Uuid,
    ) -> Result<u64, FilezError> {
        let mut connection = database.get_connection().await?;

        let count = schema::file_file_group_members::table
            .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
            .count()
            .get_result::<i64>(&mut connection)
            .await?;

        Ok(count.try_into()?)
    }

    pub async fn add_files(
        database: &Database,
        file_group_id: &Uuid,
        file_ids: &Vec<Uuid>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        let new_members = file_ids
            .iter()
            .map(|file_id| FileFileGroupMember::new(file_id, file_group_id))
            .collect::<Vec<FileFileGroupMember>>();

        diesel::insert_into(schema::file_file_group_members::table)
            .values(&new_members)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    pub async fn remove_files(
        database: &Database,
        file_group_id: &Uuid,
        file_ids: &Vec<Uuid>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(
            schema::file_file_group_members::table
                .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
                .filter(schema::file_file_group_members::file_id.eq_any(file_ids)),
        )
        .execute(&mut connection)
        .await?;
        Ok(())
    }

    pub async fn list_files(
        database: &Database,
        file_group_id: &Uuid,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort: Option<ListFilesSorting>,
    ) -> Result<Vec<FilezFile>, FilezError> {
        let mut connection = database.get_connection().await?;
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
                    query = query.offset(from_index.try_into()?);
                }
                if let Some(limit) = limit {
                    query = query.limit(limit.try_into()?);
                }

                let files_list = query.load::<FilezFile>(&mut connection).await?;

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
                    query = query.offset(from_index.try_into()?);
                }
                if let Some(limit) = limit {
                    query = query.limit(limit.try_into()?);
                }

                let files_list = query.load::<FilezFile>(&mut connection).await?;

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
                    query = query.offset(from_index.try_into()?);
                }
                if let Some(limit) = limit {
                    query = query.limit(limit.try_into()?);
                }

                let files_list = query.load::<FilezFile>(&mut connection).await?;

                Ok(files_list)
            }
        }
    }
}
