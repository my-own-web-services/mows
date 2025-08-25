use std::collections::HashMap;

use crate::{database::DatabaseConnection, errors::FilezError, impl_typed_uuid, schema};
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    query_dsl::methods::FilterDsl,
    BoolExpressionMethods, ExpressionMethods, Selectable,
};
use diesel_async::RunQueryDsl;

impl_typed_uuid!(TagId);

#[derive(Queryable, Selectable, Clone, Insertable, Debug, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::tags)]
pub struct FilezTag {
    pub id: TagId,
    pub key: String,
    pub value: String,
}

impl FilezTag {
    #[tracing::instrument(level = "trace")]
    pub fn new(key: &str, value: &str) -> Self {
        Self {
            id: TagId::new(),
            key: key.to_string(),
            value: value.to_string(),
        }
    }

    #[tracing::instrument(level = "trace", skip(connection))]
    pub async fn get_or_insert_tags(
        connection: &mut DatabaseConnection,
        tags_to_get_or_insert: &HashMap<String, String>,
    ) -> Result<Vec<Self>, FilezError> {
        connection
            .build_transaction()
            .serializable()
            .run(|connection| {
                Box::pin(async move {
                    let existing_tags: Vec<FilezTag> = schema::tags::table
                        .filter(
                            schema::tags::key
                                .eq_any(tags_to_get_or_insert.keys())
                                .and(schema::tags::value.eq_any(tags_to_get_or_insert.values())),
                        )
                        .load(connection)
                        .await?;

                    let tags_to_insert: Vec<FilezTag> = tags_to_get_or_insert
                        .iter()
                        .filter(|(key, value)| {
                            !existing_tags
                                .iter()
                                .any(|tag| tag.key == **key && tag.value == **value)
                        })
                        .map(|(key, value)| FilezTag::new(key, value))
                        .collect();

                    diesel::insert_into(schema::tags::table)
                        .values(&tags_to_insert)
                        .execute(connection)
                        .await?;

                    let all_tags = [existing_tags, tags_to_insert].concat();
                    Ok(all_tags)
                })
            })
            .await
    }
}
