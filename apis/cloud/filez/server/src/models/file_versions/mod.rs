use crate::{db::Db, errors::FilezError, schema::file_versions, with_timing};
use axum::extract::Request;
use bigdecimal::BigDecimal;
use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, Selectable,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::{files::FilezFile, storage_locations::StorageLocation};

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct FileVersionsQuery {
    pub file_id: Uuid,
    pub app_id: Uuid,
    pub version: i32,
    pub app_path: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileVersion {
    pub file_id: Uuid,
    pub version: i32,
    pub app_id: Uuid,
    pub app_path: Option<String>,
    pub metadata: Option<FileVersionMetadata>,
}

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
#[diesel(table_name = crate::schema::file_versions)]
#[diesel(check_for_backend(Pg))]
pub struct FileVersion {
    pub file_id: Uuid,
    pub version: i32,
    pub app_id: Uuid,
    pub app_path: Option<String>,
    pub metadata: FileVersionMetadata,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    #[schema(value_type=i64)]
    pub size: BigDecimal,
    pub storage_id: Uuid,
}

#[derive(Serialize, Deserialize, AsJsonb, Clone, Debug, ToSchema)]
pub struct FileVersionMetadata {}

impl FileVersion {
    pub async fn get(
        db: &Db,
        file_id: &Uuid,
        version: Option<u32>,
        app_id: &Uuid,
        app_path: &Option<String>,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = db.pool.get().await?;

        // if the version is None, we fetch the latest version
        let version = if version.is_none() {
            file_versions::table
                .filter(file_versions::file_id.eq(file_id))
                .filter(file_versions::app_id.eq(app_id))
                .filter(file_versions::app_path.eq(app_path))
                .select(diesel::dsl::max(file_versions::version))
                .first::<Option<i32>>(&mut connection)
                .await?
                .unwrap_or(0)
        } else {
            version.unwrap() as i32
        };

        let file_version = file_versions::table
            .filter(file_versions::file_id.eq(file_id))
            .filter(file_versions::version.eq(version))
            .filter(file_versions::app_id.eq(app_id))
            .filter(file_versions::app_path.eq(app_path))
            .first::<FileVersion>(&mut connection)
            .await
            .map_err(|e| match e {
                diesel::result::Error::NotFound => FilezError::ResourceNotFound(format!(
                    "FileVersion not found for file_id: {}, version: {}",
                    file_id, version
                )),
                _ => FilezError::from(e),
            })?;

        Ok(file_version)
    }

    fn full_file_path(&self) -> String {
        format!(
            "{}/{}/{}/{}",
            self.file_id,
            self.version,
            self.app_id,
            self.app_path.as_deref().unwrap_or("")
        )
    }

    pub async fn get_content(
        &self,
        db: &Db,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<axum::body::Body, FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_id).await?;
        let content = storage_location
            .get_content(&self.full_file_path(), timing, range)
            .await?;

        Ok(content)
    }

    pub async fn get_file_size_from_content(
        &self,
        db: &Db,
        timing: axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_id).await?;
        let size = storage_location
            .get_file_size(&self.full_file_path(), timing)
            .await?;

        Ok(size)
    }

    pub async fn update_content(
        &self,
        db: &Db,
        timing: axum_server_timing::ServerTimingExtension,
        request: Request,
        offset: u64,
        length: u64,
    ) -> Result<(), FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_id).await?;

        let file = FilezFile::get_by_id(db, self.file_id).await?;

        storage_location
            .update_content(
                &self.full_file_path(),
                timing,
                request,
                &file.mime_type,
                offset,
                length,
            )
            .await?;

        Ok(())
    }

    pub async fn create(
        db: &Db,
        file_id: Uuid,
        app_id: Uuid,
        app_path: Option<String>,
        metadata: FileVersionMetadata,
        size: BigDecimal,
        storage_id: Uuid,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = db.pool.get().await?;

        let version_number = file_versions::table
            .filter(file_versions::file_id.eq(file_id))
            .select(diesel::dsl::max(file_versions::version))
            .first::<Option<i32>>(&mut connection)
            .await?;
        let new_version_number = version_number.map_or(0, |v| v + 1);

        let new_file_version = FileVersion {
            file_id,
            version: new_version_number,
            app_id,
            app_path,
            metadata,
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            size,
            storage_id,
        };

        let created_version = diesel::insert_into(file_versions::table)
            .values(new_file_version)
            .get_result::<FileVersion>(&mut connection)
            .await?;

        Ok(created_version)
    }

    pub async fn delete_many(
        db: &Db,
        file_versions_query: &Vec<FileVersionsQuery>,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let mut connection = db.pool.get().await?;

        for version_query in file_versions_query {
            let file_version = with_timing!(
                file_versions::table
                    .filter(file_versions::file_id.eq(version_query.file_id))
                    .filter(file_versions::version.eq(version_query.version))
                    .filter(file_versions::app_id.eq(version_query.app_id))
                    .filter(file_versions::app_path.eq(&version_query.app_path))
                    .first::<FileVersion>(&mut connection)
                    .await?,
                "Database operation to get file version",
                timing
            );

            file_version.delete_content(db, timing).await?;

            with_timing!(
                diesel::delete(
                    file_versions::table
                        .filter(file_versions::file_id.eq(version_query.file_id))
                        .filter(file_versions::version.eq(version_query.version))
                        .filter(file_versions::app_id.eq(version_query.app_id))
                        .filter(file_versions::app_path.eq(&version_query.app_path)),
                )
                .execute(&mut connection)
                .await?,
                "Database operation to delete file version",
                timing
            );
        }

        Ok(())
    }

    pub async fn get_many(
        db: &Db,
        query: &Vec<FileVersionsQuery>,
    ) -> Result<Vec<FileVersion>, FilezError> {
        let mut connection = db.pool.get().await?;
        let mut results = Vec::new();

        for request in query {
            let file_version = file_versions::table
                .filter(file_versions::file_id.eq(request.file_id))
                .filter(file_versions::version.eq(request.version))
                .filter(file_versions::app_id.eq(request.app_id))
                .filter(file_versions::app_path.eq(&request.app_path))
                .first::<FileVersion>(&mut connection)
                .await?;
            results.push(file_version);
        }

        Ok(results)
    }

    pub async fn delete_content(
        &self,
        db: &Db,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_id).await?;
        storage_location
            .delete_content(&self.full_file_path(), timing)
            .await?;

        Ok(())
    }

    pub async fn update_many(
        db: &Db,
        file_versions: &Vec<UpdateFileVersion>,
    ) -> Result<Vec<FileVersion>, FilezError> {
        let mut connection = db.pool.get().await?;
        let mut results = Vec::new();

        for file_version_update in file_versions {
            let mut file_version = file_versions::table
                .filter(file_versions::file_id.eq(file_version_update.file_id))
                .filter(file_versions::version.eq(file_version_update.version))
                .filter(file_versions::app_id.eq(file_version_update.app_id))
                .filter(file_versions::app_path.eq(&file_version_update.app_path))
                .first::<FileVersion>(&mut connection)
                .await?;

            if let Some(metadata) = &file_version_update.metadata {
                file_version.metadata = metadata.clone();
            }

            file_version.modified_time = chrono::Utc::now().naive_utc();

            let updated_version = diesel::update(
                file_versions::table
                    .filter(file_versions::file_id.eq(file_version_update.file_id))
                    .filter(file_versions::version.eq(file_version_update.version))
                    .filter(file_versions::app_id.eq(file_version_update.app_id))
                    .filter(file_versions::app_path.eq(&file_version_update.app_path)),
            )
            .set(file_version)
            .get_result::<FileVersion>(&mut connection)
            .await?;
            results.push(updated_version);
        }

        Ok(results)
    }
}
