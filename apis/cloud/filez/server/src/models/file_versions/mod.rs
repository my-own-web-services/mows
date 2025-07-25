use crate::utils::get_uuid;
use crate::{
    api::file_versions::update::UpdateFileVersion, db::Db, errors::FilezError,
    schema::file_versions, state::StorageLocationState, with_timing,
};
use axum::extract::Request;
use bigdecimal::BigDecimal;
use bigdecimal::ToPrimitive;
use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, Selectable,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use tracing::debug;
use utoipa::ToSchema;
use uuid::Uuid;

use super::{files::FilezFile, storage_locations::StorageLocation, storage_quotas::StorageQuota};

// macro to select a file version by its identifier

#[macro_export]
macro_rules! filter_file_version_by_identifier {
    ($file_version:expr) => {
        file_versions::table
            .filter(file_versions::file_id.eq($file_version.file_id))
            .filter(file_versions::version.eq($file_version.version))
            .filter(file_versions::app_id.eq($file_version.app_id))
            .filter(file_versions::app_path.eq(&$file_version.app_path))
    };
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
pub struct FileVersionIdentifier {
    pub file_id: Uuid,
    pub version: i32,
    pub app_id: Uuid,
    pub app_path: String,
}

impl FileVersionIdentifier {
    pub fn to_string(&self) -> String {
        format!(
            "{}/{}/{}/{}",
            self.file_id, self.version, self.app_id, self.app_path
        )
    }
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
    pub id: Uuid,
    pub file_id: Uuid,
    pub version: i32,
    pub app_id: Uuid,
    pub app_path: String,
    pub metadata: FileVersionMetadata,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    #[schema(value_type=i64)]
    pub size: BigDecimal,
    pub storage_location_id: Uuid,
    pub storage_quota_id: Uuid,
    pub content_valid: bool,
    pub content_expected_sha256_digest: Option<String>,
}

#[derive(Serialize, Deserialize, AsJsonb, Clone, Debug, ToSchema)]
pub struct FileVersionMetadata {}

impl FileVersion {
    pub fn new(
        file_id: Uuid,
        version: i32,
        app_id: Uuid,
        app_path: Option<String>,
        metadata: FileVersionMetadata,
        created_time: chrono::NaiveDateTime,
        modified_time: chrono::NaiveDateTime,
        size: BigDecimal,
        storage_id: Uuid,
        storage_quota_id: Uuid,
        content_expected_sha256_digest: Option<String>,
    ) -> Self {
        Self {
            id: get_uuid(),
            file_id,
            version,
            app_id,
            app_path: app_path.unwrap_or("".to_string()),
            metadata,
            created_time,
            modified_time,
            size,
            storage_location_id: storage_id,
            storage_quota_id,
            content_expected_sha256_digest,
            content_valid: false,
        }
    }

    pub async fn get(
        db: &Db,
        file_id: &Uuid,
        version: Option<u32>,
        app_id: &Uuid,
        app_path: &Option<String>,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = db.get_connection().await?;

        let app_path = app_path.as_ref().map(|path| path.as_str()).unwrap_or("");

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

    fn get_file_version_identifier(&self) -> FileVersionIdentifier {
        FileVersionIdentifier {
            file_id: self.file_id,
            version: self.version,
            app_id: self.app_id,
            app_path: self.app_path.clone(),
        }
    }

    pub async fn get_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        db: &Db,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<axum::body::Body, FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_location_id).await?;
        let content = storage_location
            .get_content(
                storage_locations_provider_state,
                &self.get_file_version_identifier(),
                timing,
                range,
            )
            .await?;

        Ok(content)
    }

    pub async fn get_file_size_from_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        db: &Db,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_location_id).await?;
        let size = storage_location
            .get_file_size(
                storage_locations_provider_state,
                &self.get_file_version_identifier(),
                timing,
            )
            .await?;

        Ok(size)
    }

    pub async fn set(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        db: &Db,
        timing: &axum_server_timing::ServerTimingExtension,
        request: Request,
        offset: u64,
        length: u64,
    ) -> Result<(), FilezError> {
        if self.content_valid {
            return Err(FilezError::FileVersionContentAlreadyValid);
        }

        let storage_location = StorageLocation::get_by_id(db, &self.storage_location_id).await?;

        let file = FilezFile::get_by_id(db, self.file_id).await?;

        storage_location
            .set_content(
                storage_locations_provider_state,
                &self.get_file_version_identifier(),
                timing,
                request,
                &file.mime_type,
                offset,
                length,
            )
            .await?;
        // once the last bytes are written, we verify the content and update the content_valid flag

        let file_version_size = self
            .size
            .to_u64()
            .ok_or(FilezError::BigDecimalSizeConversionError)?;

        debug!(
            "Got offset: {}, length: {}, file_version_size: {} for file version: {:?}",
            offset, length, file_version_size, self
        );

        if offset + length == file_version_size {
            if let Some(expected_sha256_digest) = &self.content_expected_sha256_digest {
                debug!(
                    "Verifying content for file version: {:?} with expected digest: {}",
                    self, expected_sha256_digest
                );

                let content_digest = storage_location
                    .get_content_sha256_digest(
                        storage_locations_provider_state,
                        &self.get_file_version_identifier(),
                        timing,
                    )
                    .await?;

                debug!(
                    "Content digest for file version: {:?} is: {}",
                    self, content_digest
                );

                if &content_digest == expected_sha256_digest {
                    let mut connection = db.get_connection().await?;
                    diesel::update(filter_file_version_by_identifier!(self))
                        .set((
                            file_versions::content_valid.eq(true),
                            file_versions::modified_time.eq(chrono::Utc::now().naive_utc()),
                        ))
                        .execute(&mut connection)
                        .await?;
                } else {
                    return Err(FilezError::FileVersionContentDigestMismatch {
                        expected: expected_sha256_digest.clone(),
                        received: content_digest,
                    });
                }
            }
        }
        Ok(())
    }

    pub async fn create(
        db: &Db,
        file_id: Uuid,
        app_id: Uuid,
        app_path: Option<String>,
        metadata: FileVersionMetadata,
        size: BigDecimal,
        storage_quota_id: Uuid,
        content_expected_sha256_digest: Option<String>,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = db.get_connection().await?;

        let storage_id = StorageQuota::get_storage_location_id(db, &storage_quota_id).await?;

        let version_number = file_versions::table
            .filter(file_versions::file_id.eq(file_id))
            .select(diesel::dsl::max(file_versions::version))
            .first::<Option<i32>>(&mut connection)
            .await?;

        let new_version_number = version_number.map_or(0, |v| v + 1);

        let new_file_version = FileVersion::new(
            file_id,
            new_version_number,
            app_id,
            app_path,
            metadata,
            chrono::Utc::now().naive_utc(),
            chrono::Utc::now().naive_utc(),
            size,
            storage_id,
            storage_quota_id,
            content_expected_sha256_digest,
        );

        let created_version = diesel::insert_into(file_versions::table)
            .values(new_file_version)
            .get_result::<FileVersion>(&mut connection)
            .await?;

        Ok(created_version)
    }

    pub async fn delete_many(
        storage_locations_provider_state: &StorageLocationState,
        db: &Db,
        file_versions_query: &Vec<FileVersionIdentifier>,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let mut connection = db.get_connection().await?;

        for version_query in file_versions_query {
            let file_version = with_timing!(
                filter_file_version_by_identifier!(version_query)
                    .first::<FileVersion>(&mut connection)
                    .await?,
                "Database operation to get file version",
                timing
            );

            file_version
                .delete_content(storage_locations_provider_state, db, timing)
                .await?;

            with_timing!(
                diesel::delete(filter_file_version_by_identifier!(version_query),)
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
        query: &Vec<FileVersionIdentifier>,
    ) -> Result<Vec<FileVersion>, FilezError> {
        let mut connection = db.get_connection().await?;
        let mut results = Vec::new();

        for request in query {
            let file_version = filter_file_version_by_identifier!(request)
                .first::<FileVersion>(&mut connection)
                .await?;
            results.push(file_version);
        }

        Ok(results)
    }

    pub async fn delete_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        db: &Db,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let storage_location = StorageLocation::get_by_id(db, &self.storage_location_id).await?;
        storage_location
            .delete_content(
                storage_locations_provider_state,
                &self.get_file_version_identifier(),
                timing,
            )
            .await?;

        Ok(())
    }

    pub async fn update_many(
        db: &Db,
        file_versions: &Vec<UpdateFileVersion>,
    ) -> Result<Vec<FileVersion>, FilezError> {
        let mut connection = db.get_connection().await?;
        let mut results = Vec::new();

        for file_version_update in file_versions {
            let mut file_version =
                filter_file_version_by_identifier!(file_version_update.identifier)
                    .first::<FileVersion>(&mut connection)
                    .await?;

            if let Some(metadata) = &file_version_update.new_metadata {
                file_version.metadata = metadata.clone();
                file_version.modified_time = chrono::Utc::now().naive_utc();
            }

            if let Some(new_digest) = &file_version_update.new_content_expected_sha256_digest {
                file_version.content_expected_sha256_digest = Some(new_digest.clone());
                file_version.content_valid = false;
                file_version.modified_time = chrono::Utc::now().naive_utc();
            }

            let updated_version = diesel::update(filter_file_version_by_identifier!(
                file_version_update.identifier
            ))
            .set(file_version)
            .get_result::<FileVersion>(&mut connection)
            .await?;
            results.push(updated_version);
        }

        Ok(results)
    }
}
