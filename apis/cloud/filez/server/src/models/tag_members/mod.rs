use crate::{
    database::Database,
    errors::FilezError,
    http_api::tags::{
        list::{ListTagResult, ListTagsSearch, ListTagsSortBy},
        update::UpdateTagsMethod,
    },
    models::{
        access_policies::{AccessPolicyAction, AccessPolicyResourceType},
        tags::{FilezTag, TagId},
        users::FilezUserId,
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
    pub async fn list_tags(
        database: &Database,
        search: Option<&ListTagsSearch>,
        resource_type: Option<TagResourceType>,
        accessible_resource_ids: Option<&[Uuid]>,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListTagsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<(Vec<ListTagResult>, u64), FilezError> {
        let mut connection = database.get_connection().await?;

        todo!()
    }
}
