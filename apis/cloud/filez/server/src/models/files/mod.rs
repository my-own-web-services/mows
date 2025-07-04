pub mod errors;

use std::collections::HashMap;

use axum::body::Body;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;

use diesel_as_jsonb::AsJsonb;
use errors::FilezFileError;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::utils::get_uuid;

use super::users::FilezUser;

#[derive(
    Serialize,
    Deserialize,
    Queryable,
    Selectable,
    ToSchema,
    Insertable,
    Clone,
    QueryableByName,
    Debug,
)]
#[diesel(table_name = crate::schema::files)]
#[diesel(check_for_backend(Pg))]
pub struct FilezFile {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub mime_type: String,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub metadata: FileMetadata,
}

impl FilezFile {
    pub fn new(owner: &FilezUser, mime_type: &Mime, file_name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            mime_type: mime_type.to_string(),
            name: file_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            metadata: FileMetadata::new(),
        }
    }

    pub async fn get_by_id(
        db: &crate::db::Db,
        file_id: uuid::Uuid,
    ) -> Result<Self, FilezFileError> {
        Ok(crate::schema::files::table
            .filter(crate::schema::files::id.eq(file_id))
            .select(FilezFile::as_select())
            .first::<FilezFile>(&mut db.pool.get().await?)
            .await?)
    }

    pub async fn create(&self, db: &crate::db::Db) -> Result<FilezFile, FilezFileError> {
        Ok(diesel::insert_into(crate::schema::files::table)
            .values(self)
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut db.pool.get().await?)
            .await?)
    }

    pub async fn delete(db: &crate::db::Db, file_id: uuid::Uuid) -> Result<(), FilezFileError> {
        // delete the file and all versions associated with it

        diesel::delete(crate::schema::file_versions::table)
            .filter(crate::schema::file_versions::file_id.eq(file_id))
            .execute(&mut db.pool.get().await?)
            .await?;

        diesel::delete(crate::schema::files::table)
            .filter(crate::schema::files::id.eq(file_id))
            .execute(&mut db.pool.get().await?)
            .await?;

        Ok(())
    }
}

#[derive(Serialize, Deserialize, AsJsonb, ToSchema, Clone, Debug)]
pub struct FileMetadata {
    /// Place for apps to store custom data related to the file.
    /// every app is identified by its id, and can only access its own data.
    pub private_app_data: HashMap<Uuid, serde_json::Value>,
    /// Apps can provide and request shared app data from other apps on creation
    pub shared_app_data: HashMap<Uuid, serde_json::Value>,
    /// Extracted data from the file, such as text content, metadata, etc.
    pub extracted_data: serde_json::Value,
    pub default_preview_app_id: Option<Uuid>,
}

impl FileMetadata {
    pub fn new() -> Self {
        Self {
            private_app_data: HashMap::new(),
            shared_app_data: HashMap::new(),
            extracted_data: serde_json::Value::Null,
            default_preview_app_id: None,
        }
    }
}
