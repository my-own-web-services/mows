use crate::models::apps::MowsAppId;
use crate::models::files::FilezFileId;
use crate::models::storage_locations::StorageLocationId;
use crate::models::storage_quotas::StorageQuotaId;
use crate::utils::get_current_timestamp;
use crate::validation::validate_optional_mime_type;
use crate::{
    database::Database, errors::FilezError, schema::file_versions, state::StorageLocationState,
    with_timing,
};
use crate::{impl_typed_uuid, schema};
use axum::extract::Request;

use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, Selectable,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use tracing::trace;
use utoipa::ToSchema;

use super::{files::FilezFile, storage_locations::StorageLocation, storage_quotas::StorageQuota};

// macro to select a file version by its identifier

#[macro_export]
macro_rules! filter_file_version_by_identifier {
    ($file_version:expr) => {{
        let version: i32 = $file_version.version.try_into()?;

        file_versions::table
            .filter(file_versions::file_id.eq($file_version.file_id))
            .filter(file_versions::version.eq(version))
            .filter(file_versions::app_id.eq($file_version.app_id))
            .filter(file_versions::app_path.eq(&$file_version.app_path))
    }};
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
pub struct FileVersionIdentifier {
    pub file_id: FilezFileId,
    pub version: u32,
    pub app_id: MowsAppId,
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

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
pub struct ContentRange {
    pub start: u64,
    pub end: u64,
}

impl ContentRange {
    pub fn length(&self) -> u64 {
        self.end - self.start + 1
    }
}

impl_typed_uuid!(FileVersionId);

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
#[diesel(table_name = schema::file_versions)]
#[diesel(check_for_backend(Pg))]
pub struct FileVersion {
    pub id: FileVersionId,
    pub file_id: FilezFileId,
    pub version: i32,
    pub app_id: MowsAppId,
    pub app_path: String,
    pub mime_type: String,
    pub metadata: FileVersionMetadata,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub size: i64,
    pub storage_location_id: StorageLocationId,
    pub storage_quota_id: StorageQuotaId,
    pub content_valid: bool,
    pub content_expected_sha256_digest: Option<String>,
    pub existing_content_bytes: Option<i64>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate, AsChangeset)]
#[diesel(table_name = schema::file_versions)]
pub struct UpdateFileVersionChangeset {
    #[diesel(column_name = metadata)]
    pub new_file_version_metadata: Option<FileVersionMetadata>,
    #[schema(max_length = 64, min_length = 64, pattern = "^[a-f0-9]{64}$")]
    #[validate(pattern = "^[a-f0-9]{64}$")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    #[diesel(column_name = content_expected_sha256_digest)]
    pub new_content_expected_sha256_digest: Option<Option<String>>,
    #[validate(custom = validate_optional_mime_type)]
    #[diesel(column_name = mime_type)]
    pub new_file_version_mime_type: Option<String>,
}

#[derive(Serialize, Deserialize, AsJsonb, Clone, Debug, ToSchema)]
pub struct FileVersionMetadata {}

impl FileVersion {
    #[tracing::instrument(level = "trace")]
    pub fn new(
        file_id: FilezFileId,
        version: i32,
        app_id: MowsAppId,
        app_path: Option<String>,
        mime_type: String,
        metadata: FileVersionMetadata,
        size: u64,
        storage_location_id: StorageLocationId,
        storage_quota_id: StorageQuotaId,
        content_expected_sha256_digest: Option<String>,
    ) -> Result<Self, FilezError> {
        Ok(Self {
            id: FileVersionId::new(),
            file_id,
            version,
            app_id,
            app_path: app_path.unwrap_or("".to_string()),
            mime_type,
            metadata,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            size: size.try_into()?,
            storage_location_id,
            storage_quota_id,
            content_expected_sha256_digest,
            content_valid: false,
            existing_content_bytes: None,
        })
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn get_one_by_identifier(
        database: &Database,
        file_id: &FilezFileId,
        version: Option<u32>,
        app_id: &MowsAppId,
        app_path: &Option<String>,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = database.get_connection().await?;

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

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_file_version_id(
        database: &Database,
        file_version_id: &Vec<FileVersionId>,
    ) -> Result<Vec<FileVersion>, FilezError> {
        let mut connection = database.get_connection().await?;

        let file_versions = file_versions::table
            .filter(file_versions::id.eq_any(file_version_id))
            .load::<FileVersion>(&mut connection)
            .await?;

        Ok(file_versions)
    }

    pub async fn get_all_by_file_id(
        database: &Database,
        file_id: FilezFileId,
    ) -> Result<Vec<FileVersion>, FilezError> {
        let mut connection = database.get_connection().await?;

        let file_versions = file_versions::table
            .filter(file_versions::file_id.eq(file_id))
            .load::<FileVersion>(&mut connection)
            .await?;

        Ok(file_versions)
    }

    #[tracing::instrument(level = "trace")]
    fn get_file_version_identifier(&self) -> Result<FileVersionIdentifier, FilezError> {
        Ok(FileVersionIdentifier {
            file_id: self.file_id,
            version: self.version.try_into()?,
            app_id: self.app_id,
            app_path: self.app_path.clone(),
        })
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn get_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        database: &Database,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<ContentRange>,
    ) -> Result<axum::body::Body, FilezError> {
        let storage_location =
            StorageLocation::get_by_id(database, &self.storage_location_id).await?;
        let content = storage_location
            .get_content(
                storage_locations_provider_state,
                &self.get_file_version_identifier()?,
                timing,
                range,
            )
            .await?;

        Ok(content)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn get_file_size_from_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        database: &Database,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<u64, FilezError> {
        let storage_location =
            StorageLocation::get_by_id(database, &self.storage_location_id).await?;
        let size = storage_location
            .get_file_size(
                storage_locations_provider_state,
                &self.get_file_version_identifier()?,
                timing,
            )
            .await?;

        Ok(size)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn set_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        database: &Database,
        timing: &axum_server_timing::ServerTimingExtension,
        request: Request,
        offset: u64,
        length: u64,
    ) -> Result<(), FilezError> {
        if self.content_valid {
            return Err(FilezError::FileVersionContentAlreadyValid);
        }

        let storage_location =
            StorageLocation::get_by_id(database, &self.storage_location_id).await?;

        let file = FilezFile::get_one_by_id(database, self.file_id).await?;

        let file_version_identifier = self.get_file_version_identifier()?;

        storage_location
            .set_content(
                storage_locations_provider_state,
                &file_version_identifier,
                timing,
                request,
                &file.mime_type,
                offset,
                length,
            )
            .await?;

        let stored_file_size: i64 = storage_location
            .get_file_size(
                storage_locations_provider_state,
                &file_version_identifier,
                timing,
            )
            .await?
            .try_into()?;

        // update the existing_content_bytes field in the database
        let mut connection = database.get_connection().await?;
        diesel::update(filter_file_version_by_identifier!(file_version_identifier))
            .set((
                file_versions::existing_content_bytes.eq(stored_file_size),
                file_versions::modified_time.eq(get_current_timestamp()),
            ))
            .execute(&mut connection)
            .await?;

        // once the last bytes are written, we verify the content and update the content_valid flag
        let file_version_size: u64 = self.size.try_into()?;

        trace!(
            "Got offset: {}, length: {}, file_version_size: {} for file version: {:?}",
            offset,
            length,
            file_version_size,
            self
        );

        if offset + length == file_version_size {
            if let Some(expected_sha256_digest) = &self.content_expected_sha256_digest {
                trace!(
                    "Verifying content for file version: {:?} with expected digest: {}",
                    self,
                    expected_sha256_digest
                );

                let content_digest = storage_location
                    .get_content_sha256_digest(
                        storage_locations_provider_state,
                        &file_version_identifier,
                        timing,
                    )
                    .await?;

                trace!(
                    "Content digest for file version: {:?} is: {}",
                    self,
                    content_digest
                );

                if &content_digest == expected_sha256_digest {
                    let mut connection = database.get_connection().await?;
                    diesel::update(filter_file_version_by_identifier!(file_version_identifier))
                        .set((
                            file_versions::content_valid.eq(true),
                            file_versions::modified_time.eq(get_current_timestamp()),
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

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn create_one(
        database: &Database,
        file_id: FilezFileId,
        version: Option<u32>,
        app_id: MowsAppId,
        app_path: Option<String>,
        mime_type: String,
        metadata: FileVersionMetadata,
        size: u64,
        storage_quota_id: StorageQuotaId,
        content_expected_sha256_digest: Option<String>,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = database.get_connection().await?;

        let storage_id = StorageQuota::get_storage_location_id(database, &storage_quota_id).await?;

        let version = match version {
            Some(v) => v.try_into()?,
            None => {
                let version_number = file_versions::table
                    .filter(file_versions::file_id.eq(file_id))
                    .select(diesel::dsl::max(file_versions::version))
                    .first::<Option<i32>>(&mut connection)
                    .await?;
                version_number.map_or(0, |v| v + 1)
            }
        };

        let new_file_version = FileVersion::new(
            file_id,
            version,
            app_id,
            app_path,
            mime_type,
            metadata,
            size,
            storage_id,
            storage_quota_id,
            content_expected_sha256_digest,
        )?;

        let created_file_version = diesel::insert_into(file_versions::table)
            .values(new_file_version)
            .get_result::<FileVersion>(&mut connection)
            .await?;

        Ok(created_file_version)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn delete_one(
        database: &Database,
        storage_locations_provider_state: &StorageLocationState,
        timing: &axum_server_timing::ServerTimingExtension,
        file_version_to_delete: &FileVersion,
    ) -> Result<(), FilezError> {
        if file_version_to_delete
            .existing_content_bytes
            .is_some_and(|b| b > 0)
        {
            file_version_to_delete
                .delete_content(storage_locations_provider_state, database, timing)
                .await?;
        }

        with_timing!(
            file_version_to_delete
                .delete_database_entry(database)
                .await?,
            "Database operation to delete file version",
            timing
        );

        Ok(())
    }

    async fn delete_database_entry(&self, database: &Database) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;

        diesel::delete(file_versions::table.filter(file_versions::id.eq(self.id)))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn get_by_id(
        database: &Database,
        file_version_id: &FileVersionId,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = database.get_connection().await?;

        Ok(file_versions::table
            .filter(file_versions::id.eq(file_version_id))
            .first::<FileVersion>(&mut connection)
            .await?)
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn delete_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        database: &Database,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let storage_location =
            StorageLocation::get_by_id(database, &self.storage_location_id).await?;
        storage_location
            .delete_content(
                storage_locations_provider_state,
                &self.get_file_version_identifier()?,
                timing,
            )
            .await?;

        Ok(())
    }

    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn update_one(
        database: &Database,
        file_version_id: &FileVersionId,
        changeset: &UpdateFileVersionChangeset,
    ) -> Result<FileVersion, FilezError> {
        let mut connection = database.get_connection().await?;

        let updated_file_version =
            diesel::update(file_versions::table.filter(file_versions::id.eq(file_version_id)))
                .set((
                    changeset,
                    file_versions::modified_time.eq(get_current_timestamp()),
                ))
                .get_result::<FileVersion>(&mut connection)
                .await?;
        Ok(updated_file_version)
    }
}
