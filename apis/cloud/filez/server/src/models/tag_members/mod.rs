use crate::{
    database::Database,
    errors::FilezError,
    http_api::tags::{
        list::{ListTagResult, ListTagsSearch, ListTagsSortBy},
        update::UpdateTagsMethod,
    },
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        tags::{FilezTag, TagId},
        users::{FilezUser, FilezUserId},
    },
    schema::{self},
    types::SortDirection,
    utils::{get_current_timestamp, InvalidEnumType},
};
use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{Associations, Insertable, Queryable, QueryableByName},
    sql_types::SmallInt,
    BoolExpressionMethods, ExpressionMethods, QueryDsl, Selectable,
};
use std::collections::HashMap;
use uuid::Uuid;

use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use tracing::trace;
use utoipa::ToSchema;

#[derive(
    Debug,
    Serialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum TagResourceType {
    File = 0,
    FileVersion = 1,
    FileGroup = 2,
    User = 3,
    UserGroup = 4,
    StorageLocation = 5,
    AccessPolicy = 6,
    StorageQuota = 7,
}

impl TagResourceType {
    pub fn to_access_policy_resource_type(&self) -> AccessPolicyResourceType {
        match self {
            TagResourceType::File => AccessPolicyResourceType::File,
            TagResourceType::FileVersion => AccessPolicyResourceType::File,
            TagResourceType::FileGroup => AccessPolicyResourceType::FileGroup,
            TagResourceType::User => AccessPolicyResourceType::User,
            TagResourceType::UserGroup => AccessPolicyResourceType::UserGroup,
            TagResourceType::StorageLocation => AccessPolicyResourceType::StorageLocation,
            TagResourceType::AccessPolicy => AccessPolicyResourceType::AccessPolicy,
            TagResourceType::StorageQuota => AccessPolicyResourceType::StorageQuota,
        }
    }

    pub fn to_access_policy_get_action(&self) -> AccessPolicyAction {
        match self {
            TagResourceType::File => AccessPolicyAction::FilezFilesGet,
            TagResourceType::FileVersion => AccessPolicyAction::FilezFilesGet,
            TagResourceType::FileGroup => AccessPolicyAction::FileGroupsGet,
            TagResourceType::User => AccessPolicyAction::UsersGet,
            TagResourceType::UserGroup => AccessPolicyAction::UserGroupsGet,
            TagResourceType::StorageLocation => AccessPolicyAction::StorageLocationsGet,
            TagResourceType::AccessPolicy => AccessPolicyAction::AccessPoliciesGet,
            TagResourceType::StorageQuota => AccessPolicyAction::StorageQuotasGet,
        }
    }
}

#[derive(Queryable, Selectable, Clone, Insertable, Debug, Associations, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::tag_members)]
#[diesel(belongs_to(FilezTag, foreign_key = tag_id))]
pub struct TagMember {
    pub resource_id: Uuid,
    pub resource_type: TagResourceType,
    pub tag_id: TagId,
    pub created_time: chrono::NaiveDateTime,
    pub created_by_user_id: FilezUserId,
}

impl TagMember {
    #[tracing::instrument(level = "trace")]
    pub fn new(
        resource_id: Uuid,
        resource_type: TagResourceType,
        tag_id: TagId,
        created_by_user_id: FilezUserId,
    ) -> Self {
        Self {
            resource_id,
            resource_type,
            tag_id,
            created_time: get_current_timestamp(),
            created_by_user_id,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_tags(
        database: &Database,
        resource_ids: &[Uuid],
        resource_type: TagResourceType,
    ) -> Result<HashMap<Uuid, HashMap<String, String>>, FilezError> {
        let mut connection = database.get_connection().await?;

        let results = schema::tag_members::table
            .inner_join(schema::tags::table)
            .filter(schema::tag_members::resource_id.eq_any(resource_ids))
            .filter(schema::tag_members::resource_type.eq(resource_type))
            .select((
                schema::tag_members::resource_id,
                (schema::tags::key, schema::tags::value),
            ))
            .load::<(Uuid, (String, String))>(&mut connection)
            .await?;

        let mut resource_tags_map: HashMap<Uuid, HashMap<String, String>> = HashMap::new();
        for (resource_id, (key, value)) in results {
            resource_tags_map
                .entry(resource_id)
                .or_default()
                .insert(key, value);
        }

        Ok(resource_tags_map)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_tags(
        database: &Database,
        requesting_user_id: &FilezUserId,
        resource_ids: &[Uuid],
        resource_type: TagResourceType,
        update_tags: UpdateTagsMethod,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;

        let found_resources_count: i64 = match resource_type {
            TagResourceType::File => {
                schema::files::table
                    .filter(schema::files::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::FileVersion => {
                schema::file_versions::table
                    .filter(schema::file_versions::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::FileGroup => {
                schema::file_groups::table
                    .filter(schema::file_groups::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::User => {
                schema::users::table
                    .filter(schema::users::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::UserGroup => {
                schema::user_groups::table
                    .filter(schema::user_groups::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::StorageLocation => {
                schema::storage_locations::table
                    .filter(schema::storage_locations::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::AccessPolicy => {
                schema::access_policies::table
                    .filter(schema::access_policies::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
            TagResourceType::StorageQuota => {
                schema::storage_quotas::table
                    .filter(schema::storage_quotas::id.eq_any(resource_ids))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
            }
        };

        let found_resources_count: u64 = found_resources_count.try_into()?;

        if found_resources_count != resource_ids.len() as u64 {
            return Err(FilezError::ResourceNotFound(
                "Some resources do not exist".to_string(),
            ));
        }

        match update_tags {
            UpdateTagsMethod::Add(tags_to_add_key_value_map) => {
                if tags_to_add_key_value_map.is_empty() {
                    return Ok(());
                }
                let tags_to_add =
                    FilezTag::get_or_insert_tags(&mut connection, &tags_to_add_key_value_map)
                        .await?;

                trace!(
                    tags_to_add_ids = ?tags_to_add,
                    "Tags to add IDs: {:?}", tags_to_add
                );

                let tag_members_to_insert: Vec<TagMember> = resource_ids
                    .iter()
                    .flat_map(|resource_id| {
                        tags_to_add.iter().map(|tag| {
                            TagMember::new(*resource_id, resource_type, tag.id, *requesting_user_id)
                        })
                    })
                    .collect();

                diesel::insert_into(schema::tag_members::table)
                    .values(&tag_members_to_insert)
                    .on_conflict_do_nothing()
                    .execute(&mut connection)
                    .await?;
            }
            UpdateTagsMethod::Remove(tags_to_remove) => {
                diesel::delete(
                    schema::tag_members::table.filter(
                        schema::tag_members::resource_type
                            .eq(resource_type)
                            .and(schema::tag_members::resource_id.eq_any(resource_ids))
                            .and(
                                schema::tag_members::tag_id.eq_any(
                                    schema::tags::table
                                        .filter(
                                            schema::tags::key.eq_any(tags_to_remove.keys()).and(
                                                schema::tags::value.eq_any(tags_to_remove.values()),
                                            ),
                                        )
                                        .select(schema::tags::id),
                                ),
                            ),
                    ),
                )
                .execute(&mut connection)
                .await?;
            }
            UpdateTagsMethod::Set(tags_to_set_key_value_map) => {
                let tags_to_add =
                    FilezTag::get_or_insert_tags(&mut connection, &tags_to_set_key_value_map)
                        .await?;

                let tag_members_to_insert: Vec<TagMember> = resource_ids
                    .iter()
                    .flat_map(|resource_id| {
                        tags_to_add.iter().map(|tag| {
                            TagMember::new(*resource_id, resource_type, tag.id, *requesting_user_id)
                        })
                    })
                    .collect();

                connection
                    .transaction::<_, FilezError, _>(|connection| {
                        async move {
                            diesel::delete(
                                schema::tag_members::table.filter(
                                    schema::tag_members::resource_type
                                        .eq(resource_type)
                                        .and(schema::tag_members::resource_id.eq_any(resource_ids)),
                                ),
                            )
                            .execute(connection)
                            .await?;

                            diesel::insert_into(schema::tag_members::table)
                                .values(&tag_members_to_insert)
                                .on_conflict_do_nothing()
                                .execute(connection)
                                .await?;

                            Ok(())
                        }
                        .scope_boxed()
                    })
                    .await?;
            }
            UpdateTagsMethod::Clear => {
                diesel::delete(
                    schema::tag_members::table.filter(
                        schema::tag_members::resource_type
                            .eq(resource_type)
                            .and(schema::tag_members::resource_id.eq_any(resource_ids)),
                    ),
                )
                .execute(&mut connection)
                .await?;
            }
        }

        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_tags_with_access(
        database: &Database,
        maybe_requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        search: Option<&ListTagsSearch>,
        resource_type: TagResourceType,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListTagsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<(Vec<ListTagResult>, u64), FilezError> {
        let mut connection = database.get_connection().await?;

        let owned_resource_ids = match resource_type {
            TagResourceType::File => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::File,
                    AccessPolicyAction::FilezFilesGet,
                )
                .await?
            }
            TagResourceType::FileVersion => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::File,
                    AccessPolicyAction::FilezFilesGet,
                )
                .await?
            }
            TagResourceType::FileGroup => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::FileGroup,
                    AccessPolicyAction::FileGroupsGet,
                )
                .await?
            }
            TagResourceType::User => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::User,
                    AccessPolicyAction::UsersGet,
                )
                .await?
            }
            TagResourceType::UserGroup => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::UserGroup,
                    AccessPolicyAction::UserGroupsGet,
                )
                .await?
            }
            TagResourceType::StorageLocation => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::StorageLocation,
                    AccessPolicyAction::StorageLocationsGet,
                )
                .await?
            }
            TagResourceType::AccessPolicy => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::AccessPolicy,
                    AccessPolicyAction::AccessPoliciesGet,
                )
                .await?
            }
            TagResourceType::StorageQuota => {
                AccessPolicy::get_resources_with_access(
                    database,
                    maybe_requesting_user,
                    requesting_app,
                    AccessPolicyResourceType::StorageQuota,
                    AccessPolicyAction::StorageQuotasGet,
                )
                .await?
            }
        };

        if owned_resource_ids.is_empty() {
            return Ok((vec![], 0));
        }

        // Build the main query to get tags for accessible resources
        let mut query = schema::tag_members::table
            .inner_join(schema::tags::table)
            .filter(schema::tag_members::resource_type.eq(resource_type))
            .filter(schema::tag_members::resource_id.eq_any(&owned_resource_ids))
            .group_by((schema::tags::key, schema::tags::value))
            .select((
                schema::tags::key,
                schema::tags::value,
                diesel::dsl::count_star(),
            ))
            .into_boxed();

        // Apply search filters if provided
        if let Some(search) = search {
            if let Some(plain_string) = &search.plain_string {
                let search_pattern = format!("%{}%", plain_string.to_lowercase());
                query = query.filter(diesel::dsl::sql::<diesel::sql_types::Bool>(&format!(
                    "LOWER(tags.key) LIKE '{}' OR LOWER(tags.value) LIKE '{}'",
                    search_pattern, search_pattern
                )));
            }

            if let Some(tag_key) = &search.tag_key {
                let key_pattern = format!("%{}%", tag_key.to_lowercase());
                query = query.filter(diesel::dsl::sql::<diesel::sql_types::Bool>(&format!(
                    "LOWER(tags.key) LIKE '{}'",
                    key_pattern
                )));
            }

            if let Some(tag_value) = &search.tag_value {
                let value_pattern = format!("%{}%", tag_value.to_lowercase());
                query = query.filter(diesel::dsl::sql::<diesel::sql_types::Bool>(&format!(
                    "LOWER(tags.value) LIKE '{}'",
                    value_pattern
                )));
            }
        }

        // Execute query to get all results first (for counting)
        let all_results: Vec<(String, String, i64)> = query.load(&mut connection).await?;
        let total_count: u64 = all_results.len().try_into()?;

        // Apply sorting to the results
        let mut sorted_results = all_results;

        let sort_by = sort_by.unwrap_or(ListTagsSortBy::UsageCount);
        let sort_order = sort_order.unwrap_or(SortDirection::Descending);

        match (sort_by, sort_order) {
            (ListTagsSortBy::TagKey, SortDirection::Ascending) => {
                sorted_results.sort_by(|a, b| a.0.cmp(&b.0));
            }
            (ListTagsSortBy::TagKey, SortDirection::Descending) => {
                sorted_results.sort_by(|a, b| b.0.cmp(&a.0));
            }
            (ListTagsSortBy::TagValue, SortDirection::Ascending) => {
                sorted_results.sort_by(|a, b| a.1.cmp(&b.1));
            }
            (ListTagsSortBy::TagValue, SortDirection::Descending) => {
                sorted_results.sort_by(|a, b| b.1.cmp(&a.1));
            }
            (ListTagsSortBy::UsageCount, SortDirection::Ascending) => {
                sorted_results.sort_by(|a, b| a.2.cmp(&b.2));
            }
            (ListTagsSortBy::UsageCount, SortDirection::Descending) => {
                sorted_results.sort_by(|a, b| b.2.cmp(&a.2));
            }
            // For CreatedTime and ModifiedTime, we'll use tag key as fallback since
            // the aggregated query doesn't have access to timestamp fields
            (ListTagsSortBy::CreatedTime, SortDirection::Ascending) => {
                sorted_results.sort_by(|a, b| a.0.cmp(&b.0));
            }
            (ListTagsSortBy::CreatedTime, SortDirection::Descending) => {
                sorted_results.sort_by(|a, b| b.0.cmp(&a.0));
            }
            (ListTagsSortBy::ModifiedTime, SortDirection::Ascending) => {
                sorted_results.sort_by(|a, b| a.0.cmp(&b.0));
            }
            (ListTagsSortBy::ModifiedTime, SortDirection::Descending) => {
                sorted_results.sort_by(|a, b| b.0.cmp(&a.0));
            }
            // Handle Neutral cases by defaulting to descending order
            (ListTagsSortBy::TagKey, SortDirection::Neutral) => {
                sorted_results.sort_by(|a, b| b.0.cmp(&a.0));
            }
            (ListTagsSortBy::TagValue, SortDirection::Neutral) => {
                sorted_results.sort_by(|a, b| b.1.cmp(&a.1));
            }
            (ListTagsSortBy::UsageCount, SortDirection::Neutral) => {
                sorted_results.sort_by(|a, b| b.2.cmp(&a.2));
            }
            (ListTagsSortBy::CreatedTime, SortDirection::Neutral) => {
                sorted_results.sort_by(|a, b| b.0.cmp(&a.0));
            }
            (ListTagsSortBy::ModifiedTime, SortDirection::Neutral) => {
                sorted_results.sort_by(|a, b| b.0.cmp(&a.0));
            }
        }

        // Apply pagination
        let from_index = from_index.unwrap_or(0) as usize;
        let limit = limit.map(|l| l as usize);

        let paginated_results: Vec<(String, String, i64)> = if let Some(limit) = limit {
            sorted_results
                .into_iter()
                .skip(from_index)
                .take(limit)
                .collect()
        } else {
            sorted_results.into_iter().skip(from_index).collect()
        };

        // Convert to ListTagResult
        let final_results: Vec<ListTagResult> = paginated_results
            .into_iter()
            .map(|(tag_key, tag_value, usage_count)| ListTagResult {
                tag_key,
                tag_value,
                resource_type,
                usage_count: usage_count.try_into().unwrap_or(0),
            })
            .collect();

        Ok((final_results, total_count))
    }
}
