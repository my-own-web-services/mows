use std::collections::HashMap;

use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    ExpressionMethods, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;

use diesel_as_jsonb::AsJsonb;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    database::Database,
    errors::FilezError,
    schema,
    utils::{get_current_timestamp, get_uuid},
    validation::validate_file_name,
};

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
    AsChangeset,
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
    pub fn new(owner: &FilezUser, mime_type: &Mime, file_name: &str) -> Result<Self, FilezError> {
        validate_file_name(file_name)?;
        Ok(Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            mime_type: mime_type.to_string(),
            name: file_name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            metadata: FileMetadata::new(),
        })
    }

    pub async fn get_by_id(database: &Database, file_id: uuid::Uuid) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        Ok(crate::schema::files::table
            .filter(crate::schema::files::id.eq(file_id))
            .select(FilezFile::as_select())
            .first::<FilezFile>(&mut connection)
            .await?)
    }

    pub async fn create(&self, database: &Database) -> Result<FilezFile, FilezError> {
        let mut connection = database.get_connection().await?;
        Ok(diesel::insert_into(crate::schema::files::table)
            .values(self)
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut connection)
            .await?)
    }

    pub async fn delete(database: &Database, file_id: uuid::Uuid) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(crate::schema::file_versions::table)
            .filter(crate::schema::file_versions::file_id.eq(file_id))
            .execute(&mut connection)
            .await?;

        diesel::delete(crate::schema::files::table)
            .filter(crate::schema::files::id.eq(file_id))
            .execute(&mut connection)
            .await?;

        Ok(())
    }

    pub async fn update(&mut self, database: &Database) -> Result<FilezFile, FilezError> {
        self.modified_time = get_current_timestamp();
        let mut connection = database.get_connection().await?;

        Ok(diesel::update(crate::schema::files::table)
            .filter(crate::schema::files::id.eq(self.id))
            .set(self.clone())
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut connection)
            .await?)
    }

    pub async fn get_many_by_id(
        database: &Database,
        file_ids: &Vec<Uuid>,
    ) -> Result<HashMap<Uuid, FilezFile>, FilezError> {
        let mut connection = database.get_connection().await?;

        let result = schema::files::table
            .filter(schema::files::id.eq_any(file_ids))
            .select(FilezFile::as_select())
            .load::<FilezFile>(&mut connection)
            .await?;

        let result: HashMap<Uuid, FilezFile> =
            result.into_iter().map(|file| (file.id, file)).collect();

        Ok(result)
    }
}

#[derive(Serialize, Deserialize, AsJsonb, ToSchema, Clone, Debug)]
pub struct FileMetadata {
    /// Place for apps to store custom data related to the file.
    /// every app is identified by its id, and can only access its own data.
    #[schema(additional_properties = true)]
    pub private_app_data: HashMap<Uuid, serde_json::Value>,
    #[schema(additional_properties = true)]
    /// Apps can provide and request shared app data from other apps on creation
    pub shared_app_data: HashMap<Uuid, serde_json::Value>,
    #[schema(additional_properties = true)]
    /// Extracted data from the file, such as text content, metadata, etc.
    pub extracted_data: HashMap<String, serde_json::Value>,
    pub default_preview_app_id: Option<Uuid>,
}

impl FileMetadata {
    pub fn new() -> Self {
        Self {
            private_app_data: HashMap::new(),
            shared_app_data: HashMap::new(),
            extracted_data: HashMap::new(),
            default_preview_app_id: None,
        }
    }
}
