use crate::{
    database::Database,
    errors::FilezError,
    http_api::file_groups::{
        list::ListFileGroupsSortBy,
        list_files::{ListFilesSortBy, ListFilesSorting},
    },
    impl_typed_uuid,
    models::{apps::MowsApp, files::FilezFileId, users::FilezUserId},
    schema,
    types::SortDirection,
    utils::{get_current_timestamp, InvalidEnumType},
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
use serde_valid::Validate;
use utoipa::ToSchema;

use super::{
    access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
    file_file_group_members::FileFileGroupMember,
    files::FilezFile,
    users::FilezUser,
};

impl_typed_uuid!(FileGroupId);

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct FileGroup {
    pub id: FileGroupId,
    pub owner_id: FilezUserId,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub group_type: FileGroupType,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate, AsChangeset)]
#[diesel(table_name = schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct UpdateFileGroupChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_file_group_name: Option<String>,
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
    #[tracing::instrument(level = "trace")]
    fn new(
        owner: &FilezUser,
        name: &str,
        group_type: FileGroupType,
        dynamic_group_rule: Option<DynamicGroupRule>,
    ) -> Self {
        Self {
            id: FileGroupId::new(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            group_type,
            dynamic_group_rule,
        }
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn create_one(
        database: &Database,
        owner: &FilezUser,
        name: &str,
        group_type: FileGroupType,
        dynamic_group_rule: Option<DynamicGroupRule>,
    ) -> Result<Self, FilezError> {
        let file_group = FileGroup::new(owner, name, group_type, dynamic_group_rule);
        let mut connection = database.get_connection().await?;
        let created_file_group = diesel::insert_into(schema::file_groups::table)
            .values(&file_group)
            .returning(FileGroup::as_select())
            .get_result::<FileGroup>(&mut connection)
            .await?;
        Ok(created_file_group)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn get_by_id(
        database: &Database,
        file_group_id: &FileGroupId,
    ) -> Result<FileGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let file_group = schema::file_groups::table
            .filter(schema::file_groups::id.eq(file_group_id))
            .select(FileGroup::as_select())
            .get_result::<FileGroup>(&mut connection)
            .await?;
        Ok(file_group)
    }

    pub async fn get_many_by_ids(
        database: &Database,
        file_group_ids: &Vec<FileGroupId>,
    ) -> Result<Vec<FileGroup>, FilezError> {
        let mut connection = database.get_connection().await?;
        let file_groups = schema::file_groups::table
            .filter(schema::file_groups::id.eq_any(file_group_ids))
            .select(FileGroup::as_select())
            .load::<FileGroup>(&mut connection)
            .await?;
        Ok(file_groups)
    }

    #[tracing::instrument(skip(database), level = "trace")]
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

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn update_one(
        database: &Database,
        file_group_id: &FileGroupId,
        changeset: &UpdateFileGroupChangeset,
    ) -> Result<FileGroup, FilezError> {
        let mut connection = database.get_connection().await?;
        let updated_file_group = diesel::update(schema::file_groups::table.find(file_group_id))
            .set((
                changeset,
                schema::file_groups::modified_time.eq(get_current_timestamp()),
            ))
            .returning(FileGroup::as_select())
            .get_result::<FileGroup>(&mut connection)
            .await?;

        Ok(updated_file_group)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn delete_one(
        database: &Database,
        file_group_id: &FileGroupId,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(schema::file_groups::table.find(file_group_id))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn get_file_count(
        database: &Database,
        file_group_id: &FileGroupId,
    ) -> Result<u64, FilezError> {
        let mut connection = database.get_connection().await?;

        let count = schema::file_file_group_members::table
            .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
            .count()
            .get_result::<i64>(&mut connection)
            .await?;

        Ok(count.try_into()?)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn add_files(
        database: &Database,
        file_group_id: &FileGroupId,
        file_ids: &Vec<FilezFileId>,
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

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn remove_files(
        database: &Database,
        file_group_id: &FileGroupId,
        file_ids: &Vec<FilezFileId>,
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

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn list_files(
        database: &Database,
        file_group_id: &FileGroupId,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort: Option<ListFilesSorting>,
    ) -> Result<Vec<FilezFile>, FilezError> {
        let mut connection = database.get_connection().await?;
        match sort {
            Some(ListFilesSorting::StoredSortOrder(stored_sort_order)) => {
                let sort_direction = stored_sort_order
                    .direction
                    .unwrap_or(SortDirection::Descending);
                let sort_order_id = stored_sort_order.stored_sort_order_id;

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
