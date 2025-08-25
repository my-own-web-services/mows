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
use serde_valid::Validate;
use utoipa::ToSchema;

use crate::{
    database::Database,
    errors::FilezError,
    impl_typed_uuid,
    models::{apps::MowsAppId, users::FilezUserId},
    schema,
    utils::get_current_timestamp,
    validation::validate_optional_mime_type,
};

use super::users::FilezUser;

impl_typed_uuid!(FilezFileId);

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
#[diesel(table_name = schema::files)]
#[diesel(check_for_backend(Pg))]
pub struct FilezFile {
    pub id: FilezFileId,
    pub owner_id: FilezUserId,
    pub mime_type: String,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub metadata: FileMetadata,
}

#[derive(Serialize, Deserialize, AsChangeset, Validate, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::files)]
pub struct UpdateFileChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_file_name: Option<String>,
    #[diesel(column_name = metadata)]
    pub new_file_metadata: Option<FileMetadata>,
    #[validate(custom = validate_optional_mime_type)]
    #[diesel(column_name = mime_type)]
    pub new_file_mime_type: Option<String>,
}

impl FilezFile {
    #[tracing::instrument(level = "trace")]
    fn new(owner: &FilezUser, mime_type: &Mime, file_name: &str) -> Result<Self, FilezError> {
        Ok(Self {
            id: FilezFileId::new(),
            owner_id: owner.id.clone(),
            mime_type: mime_type.to_string(),
            name: file_name.to_string(),
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            metadata: FileMetadata::new(),
        })
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_one_by_id(
        database: &Database,
        file_id: FilezFileId,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;
        Ok(schema::files::table
            .filter(schema::files::id.eq(file_id))
            .select(FilezFile::as_select())
            .first::<FilezFile>(&mut connection)
            .await?)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        owner: &FilezUser,
        mime_type: &Mime,
        file_name: &str,
    ) -> Result<FilezFile, FilezError> {
        let mut connection = database.get_connection().await?;

        let new_file = FilezFile::new(owner, mime_type, file_name)?;
        Ok(diesel::insert_into(schema::files::table)
            .values(new_file)
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut connection)
            .await?)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(database: &Database, file_id: FilezFileId) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(schema::file_versions::table)
            .filter(schema::file_versions::file_id.eq(file_id))
            .execute(&mut connection)
            .await?;

        diesel::delete(schema::files::table)
            .filter(schema::files::id.eq(file_id))
            .execute(&mut connection)
            .await?;

        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_one(
        database: &Database,
        file_id: FilezFileId,
        changeset: UpdateFileChangeset,
    ) -> Result<FilezFile, FilezError> {
        let mut connection = database.get_connection().await?;

        let updated_file = diesel::update(schema::files::table)
            .filter(schema::files::id.eq(file_id))
            .set((
                changeset,
                schema::files::modified_time.eq(get_current_timestamp()),
            ))
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut connection)
            .await?;
        Ok(updated_file)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_id(
        database: &Database,
        file_ids: &Vec<FilezFileId>,
    ) -> Result<Vec<FilezFile>, FilezError> {
        let mut connection = database.get_connection().await?;

        let result = schema::files::table
            .filter(schema::files::id.eq_any(file_ids))
            .select(FilezFile::as_select())
            .load::<FilezFile>(&mut connection)
            .await?;

        Ok(result)
    }
}

#[derive(Serialize, Deserialize, AsJsonb, ToSchema, Clone, Debug)]
pub struct FileMetadata {
    /// Place for apps to store custom data related to the file.
    /// every app is identified by its id, and can only access its own data.
    #[schema(additional_properties = true)]
    pub private_app_data: HashMap<MowsAppId, serde_json::Value>,
    #[schema(additional_properties = true)]
    /// Apps can provide and request shared app data from other apps on creation
    pub shared_app_data: HashMap<MowsAppId, serde_json::Value>,
    #[schema(additional_properties = true)]
    /// Extracted data from the file, such as text content, metadata, etc.
    pub extracted_data: HashMap<String, serde_json::Value>,
    pub default_preview_app_id: Option<MowsAppId>,
}

impl FileMetadata {
    #[tracing::instrument(level = "trace")]
    pub fn new() -> Self {
        Self {
            private_app_data: HashMap::new(),
            shared_app_data: HashMap::new(),
            extracted_data: HashMap::new(),
            default_preview_app_id: None,
        }
    }
}
