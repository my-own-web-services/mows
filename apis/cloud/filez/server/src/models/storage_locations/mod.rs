pub mod errors;
use crate::{
    storage::{config::StorageProviderConfig, providers::StorageProvider},
    utils::get_uuid,
};
use bigdecimal::BigDecimal;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    query_dsl::methods::FilterDsl,
    ExpressionMethods, Selectable,
};
use diesel_async::RunQueryDsl;
use errors::StorageLocationError;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Serialize,
    Deserialize,
    Queryable,
    Selectable,
    ToSchema,
    Clone,
    Insertable,
    Debug,
    QueryableByName,
)]
#[diesel(table_name = crate::schema::storage_locations)]
#[diesel(check_for_backend(Pg))]
pub struct StorageLocation {
    pub id: Uuid,
    pub name: String,
    pub provider_config: StorageProviderConfig,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl StorageLocation {
    pub async fn create(
        db: &crate::db::Db,
        name: &str,
        provider: StorageProviderConfig,
    ) -> Result<Self, StorageLocationError> {
        // check if a storage location with the same name already exists
        let existing_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::name.eq(&name))
            .first::<StorageLocation>(&mut db.pool.get().await?)
            .await
            .ok();

        if existing_location.is_some() {
            return Err(StorageLocationError::NotFound(
                "Storage location with this name already exists".to_string(),
            ));
        }

        let storage_location = Self {
            id: get_uuid(),
            name: name.to_string(),
            provider_config: provider,
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        };

        let mut connection = db.pool.get().await?;

        // Insert the new storage location into the database
        diesel::insert_into(crate::schema::storage_locations::table)
            .values(&storage_location)
            .execute(&mut connection)
            .await
            .map_err(StorageLocationError::DatabaseError)?;

        Ok(storage_location)
    }

    pub async fn get_by_id(db: &crate::db::Db, id: &Uuid) -> Result<Self, StorageLocationError> {
        let mut connection = db.pool.get().await?;

        let storage_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::id.eq(id))
            .first::<StorageLocation>(&mut connection)
            .await
            .map_err(|e| match e {
                diesel::result::Error::NotFound => StorageLocationError::NotFound(format!(
                    "Storage location not found for id: {}",
                    id
                )),
                _ => StorageLocationError::from(e),
            })?;

        Ok(storage_location)
    }

    pub async fn initialize_provider(&self) -> Result<StorageProvider, StorageLocationError> {
        Ok(StorageProvider::initialize(&self.provider_config, &self.id.to_string()).await?)
    }

    pub async fn get_content(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<axum::body::Body, StorageLocationError> {
        let provider = self.initialize_provider().await?;
        Ok(provider.get_content(full_file_path, timing, range).await?)
    }

    pub async fn get_file_size(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, StorageLocationError> {
        let provider = self.initialize_provider().await?;
        Ok(provider.get_file_size(full_file_path, timing).await?)
    }
}
