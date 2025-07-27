use crate::{
    database::Database,
    errors::FilezError,
    http_api::tags::update::UpdateTagsMethod,
    models::tags::FilezTag,
    schema::{self},
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

use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

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

#[derive(Queryable, Selectable, Clone, Insertable, Debug, Associations, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::tag_members)]
#[diesel(belongs_to(FilezTag, foreign_key = tag_id))]
pub struct TagMember {
    pub resource_id: Uuid,
    pub resource_type: TagResourceType,
    pub tag_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
    pub created_by_user_id: Uuid,
}

impl TagMember {
    pub fn new(
        resource_id: Uuid,
        resource_type: TagResourceType,
        tag_id: Uuid,
        created_by_user_id: Uuid,
    ) -> Self {
        Self {
            resource_id,
            resource_type,
            tag_id,
            created_time: get_current_timestamp(),
            created_by_user_id,
        }
    }

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

    pub async fn update_tags(
        database: &Database,
        requesting_user_id: &Uuid,
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
            UpdateTagsMethod::Add(items) => {
                let tags_to_insert = items
                    .iter()
                    .map(|(key, value)| FilezTag::new(key, value))
                    .collect::<Vec<FilezTag>>();

                diesel::insert_into(schema::tags::table)
                    .values(&tags_to_insert)
                    .on_conflict_do_nothing()
                    .execute(&mut connection)
                    .await?;

                let database_tags: Vec<FilezTag> = schema::tags::table
                    .filter(
                        schema::tags::key
                            .eq_any(items.keys())
                            .and(schema::tags::value.eq_any(items.values())),
                    )
                    .load(&mut connection)
                    .await?;

                let tag_members_to_insert: Vec<TagMember> = resource_ids
                    .iter()
                    .flat_map(|resource_id| {
                        database_tags.iter().map(|tag| {
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
            UpdateTagsMethod::Remove(items) => {
                diesel::delete(
                    schema::tag_members::table.filter(
                        schema::tag_members::resource_type
                            .eq(resource_type)
                            .and(schema::tag_members::resource_id.eq_any(resource_ids))
                            .and(
                                schema::tag_members::tag_id.eq_any(
                                    schema::tags::table
                                        .filter(
                                            schema::tags::key
                                                .eq_any(items.keys())
                                                .and(schema::tags::value.eq_any(items.values())),
                                        )
                                        .select(schema::tags::id),
                                ),
                            ),
                    ),
                )
                .execute(&mut connection)
                .await?;
            }
            UpdateTagsMethod::Set(items) => {
                let tags_to_insert = items
                    .iter()
                    .map(|(key, value)| FilezTag::new(key, value))
                    .collect::<Vec<FilezTag>>();

                diesel::insert_into(schema::tags::table)
                    .values(&tags_to_insert)
                    .on_conflict((schema::tags::key, schema::tags::value))
                    .do_nothing()
                    .execute(&mut connection)
                    .await?;

                let database_tags: Vec<FilezTag> = schema::tags::table
                    .filter(
                        schema::tags::key
                            .eq_any(items.keys())
                            .and(schema::tags::value.eq_any(items.values())),
                    )
                    .load(&mut connection)
                    .await?;

                let tag_members_to_insert: Vec<TagMember> = resource_ids
                    .iter()
                    .flat_map(|resource_id| {
                        database_tags.iter().map(|tag| {
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
}
