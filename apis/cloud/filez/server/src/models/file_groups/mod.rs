pub mod errors;

use std::collections::HashMap;

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    ExpressionMethods, JoinOnDsl, QueryDsl, Selectable, SelectableHelper,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use errors::FileGroupError;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{db, schema, types::SortOrder, utils::get_uuid};

use super::{files::FilezFile, users::FilezUser};

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct FileGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl FileGroup {
    pub fn new(owner: &FilezUser, name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }
    pub async fn get_file_count(
        db: &crate::db::Db,
        file_group_id: &Uuid,
    ) -> Result<i64, FileGroupError> {
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
        sort_by: Option<&str>,
        sort_order: Option<SortOrder>,
    ) -> Result<Vec<FilezFile>, FileGroupError> {
        let mut conn = db.pool.get().await?;

        let mut query = schema::file_file_group_members::table
            .inner_join(
                schema::files::table
                    .on(schema::file_file_group_members::file_id.eq(schema::files::id)),
            )
            .filter(schema::file_file_group_members::file_group_id.eq(file_group_id))
            .select(FilezFile::as_select())
            .into_boxed();

        match (sort_by, sort_order) {
            (Some("created_time"), Some(SortOrder::Ascending)) => {
                query = query.order_by(schema::files::created_time.asc());
            }
            (Some("created_time"), Some(SortOrder::Descending)) => {
                query = query.order_by(schema::files::created_time.desc());
            }
            (Some("name"), Some(SortOrder::Ascending)) => {
                query = query.order_by(schema::files::name.asc());
            }
            (Some("name"), Some(SortOrder::Descending)) => {
                query = query.order_by(schema::files::name.desc());
            }
            _ => {
                query = query.order_by(schema::files::created_time.desc());
            }
        };

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
