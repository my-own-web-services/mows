use std::collections::HashMap;

use diesel::{
    insert_into,
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    ExpressionMethods, JoinOnDsl, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;

use diesel_as_jsonb::AsJsonb;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    api::files::meta::update::UpdateFilesMetaTypeTagsMethod, errors::FilezError, schema,
    utils::get_uuid,
};

use super::{file_tag_members::FileTagMember, tags::FilezTag, users::FilezUser};

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

    pub async fn get_by_id(db: &crate::db::Db, file_id: uuid::Uuid) -> Result<Self, FilezError> {
        Ok(crate::schema::files::table
            .filter(crate::schema::files::id.eq(file_id))
            .select(FilezFile::as_select())
            .first::<FilezFile>(&mut db.pool.get().await?)
            .await?)
    }

    pub async fn create(&self, db: &crate::db::Db) -> Result<FilezFile, FilezError> {
        Ok(diesel::insert_into(crate::schema::files::table)
            .values(self)
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut db.pool.get().await?)
            .await?)
    }

    pub async fn delete(db: &crate::db::Db, file_id: uuid::Uuid) -> Result<(), FilezError> {
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

    pub async fn update(&mut self, db: &crate::db::Db) -> Result<FilezFile, FilezError> {
        self.modified_time = chrono::Utc::now().naive_utc();

        Ok(diesel::update(crate::schema::files::table)
            .filter(crate::schema::files::id.eq(self.id))
            .set(self.clone())
            .returning(FilezFile::as_returning())
            .get_result::<FilezFile>(&mut db.pool.get().await?)
            .await?)
    }

    pub async fn get_tags(
        db: &crate::db::Db,
        file_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, HashMap<String, String>>, FilezError> {
        let mut conn = db.pool.get().await?;

        let tags: Vec<(Uuid, String, String)> = schema::file_tag_members::table
            .inner_join(
                schema::tags::table.on(schema::file_tag_members::tag_id.eq(schema::tags::id)),
            )
            .filter(schema::file_tag_members::file_id.eq_any(file_ids))
            .select((
                schema::file_tag_members::file_id,
                schema::tags::key,
                schema::tags::value,
            ))
            .load(&mut conn)
            .await?;

        let mut file_tags: HashMap<Uuid, HashMap<String, String>> = HashMap::new();

        for (file_id, key, value) in tags {
            file_tags
                .entry(file_id)
                .or_insert_with(HashMap::new)
                .insert(key, value);
        }

        Ok(file_tags)
    }

    pub async fn get_many_by_id(
        db: &crate::db::Db,
        file_ids: &Vec<Uuid>,
    ) -> Result<HashMap<Uuid, FilezFile>, FilezError> {
        let mut conn = db.pool.get().await?;

        let result = schema::files::table
            .filter(schema::files::id.eq_any(file_ids))
            .select(FilezFile::as_select())
            .load::<FilezFile>(&mut conn)
            .await?;

        let result: HashMap<Uuid, FilezFile> =
            result.into_iter().map(|file| (file.id, file)).collect();

        Ok(result)
    }

    pub async fn update_tags(
        db: &crate::db::Db,
        file_ids: &[Uuid],
        tags: &HashMap<String, String>,
        method: &UpdateFilesMetaTypeTagsMethod,
        created_by_user_id: &Uuid,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;

        match method {
            UpdateFilesMetaTypeTagsMethod::Add => {
                let tags_to_insert = tags
                    .iter()
                    .map(|(key, value)| FilezTag::new(key, value))
                    .collect::<Vec<FilezTag>>();
                insert_into(schema::tags::table)
                    .values(tags_to_insert)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)
                    .await?;

                let database_tags: Vec<FilezTag> = schema::tags::table
                    .filter(schema::tags::key.eq_any(tags.keys()))
                    .filter(schema::tags::value.eq_any(tags.values()))
                    .load(&mut conn)
                    .await?;

                let file_tag_members: Vec<FileTagMember> = database_tags
                    .iter()
                    .flat_map(|tag| {
                        file_ids.iter().map(|file_id| {
                            FileTagMember::new(*file_id, tag.id, *created_by_user_id)
                        })
                    })
                    .collect();

                insert_into(schema::file_tag_members::table)
                    .values(file_tag_members)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)
                    .await?;
            }
            UpdateFilesMetaTypeTagsMethod::Remove => {
                diesel::delete(schema::file_tag_members::table)
                    .filter(schema::file_tag_members::file_id.eq_any(file_ids))
                    .filter(
                        schema::file_tag_members::tag_id.eq_any(
                            schema::tags::table
                                .filter(schema::tags::key.eq_any(tags.keys()))
                                .filter(schema::tags::value.eq_any(tags.values()))
                                .select(schema::tags::id),
                        ),
                    )
                    .execute(&mut conn)
                    .await?;
            }
            UpdateFilesMetaTypeTagsMethod::Set => {
                diesel::delete(schema::file_tag_members::table)
                    .filter(schema::file_tag_members::file_id.eq_any(file_ids))
                    .execute(&mut conn)
                    .await?;

                let tags_to_insert = tags
                    .iter()
                    .map(|(key, value)| FilezTag::new(key, value))
                    .collect::<Vec<FilezTag>>();

                insert_into(schema::tags::table)
                    .values(tags_to_insert)
                    .on_conflict_do_nothing()
                    .execute(&mut conn)
                    .await?;

                let database_tags: Vec<FilezTag> = schema::tags::table
                    .filter(schema::tags::key.eq_any(tags.keys()))
                    .filter(schema::tags::value.eq_any(tags.values()))
                    .load(&mut conn)
                    .await?;

                let file_tag_members: Vec<FileTagMember> = database_tags
                    .iter()
                    .flat_map(|tag| {
                        file_ids.iter().map(|file_id| {
                            FileTagMember::new(*file_id, tag.id, *created_by_user_id)
                        })
                    })
                    .collect();

                insert_into(schema::file_tag_members::table)
                    .values(file_tag_members)
                    .execute(&mut conn)
                    .await?;
            }
        }

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
