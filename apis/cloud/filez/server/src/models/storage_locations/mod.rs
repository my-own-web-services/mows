use crate::{
    controller::crd::SecretReadableByFilezController,
    errors::FilezError,
    storage::{
        config::{StorageProviderConfig, StorageProviderConfigCrd},
        providers::StorageProvider,
    },
    utils::get_uuid,
};
use axum::extract::Request;
use bigdecimal::BigDecimal;
use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    ExpressionMethods, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use schemars::JsonSchema;
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
    AsChangeset,
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

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
pub struct StorageLocationConfigCrd {
    pub provider_config: StorageProviderConfigCrd,
}

impl StorageLocation {
    pub async fn delete(db: &crate::db::Db, name: &str) -> Result<(), FilezError> {
        let mut connection = db.pool.get().await?;
        diesel::delete(crate::schema::storage_locations::table)
            .filter(crate::schema::storage_locations::name.eq(name))
            .execute(&mut connection)
            .await?;

        Ok(())
    }

    pub async fn create_or_update(
        db: &crate::db::Db,
        full_name: &str,
        secrets: SecretReadableByFilezController,
        storage_location_config_crd: &StorageLocationConfigCrd,
    ) -> Result<(), FilezError> {
        let mut connection = db.pool.get().await?;

        let provider = storage_location_config_crd
            .provider_config
            .convert_secrets(secrets)?;

        let existing_storage_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::name.eq(full_name))
            .select(StorageLocation::as_select())
            .first::<StorageLocation>(&mut connection)
            .await
            .ok();

        match existing_storage_location {
            Some(mut storage_location) => {
                storage_location.modified_time = chrono::Local::now().naive_local();

                storage_location.provider_config = provider.clone();
                diesel::update(crate::schema::storage_locations::table)
                    .filter(crate::schema::storage_locations::id.eq(storage_location.id))
                    .set(&storage_location)
                    .execute(&mut connection)
                    .await?;
            }
            None => {
                let new_storage_location = StorageLocation {
                    id: get_uuid(),
                    name: full_name.to_string(),
                    provider_config: provider.clone(),
                    created_time: chrono::Local::now().naive_local(),
                    modified_time: chrono::Local::now().naive_local(),
                };
                diesel::insert_into(crate::schema::storage_locations::table)
                    .values(&new_storage_location)
                    .execute(&mut connection)
                    .await?;
            }
        }

        Ok(())
    }

    pub async fn get_by_id(db: &crate::db::Db, id: &Uuid) -> Result<Self, FilezError> {
        let mut connection = db.pool.get().await?;

        let storage_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::id.eq(id))
            .select(StorageLocation::as_select())
            .first::<StorageLocation>(&mut connection)
            .await
            .map_err(|e| match e {
                diesel::result::Error::NotFound => FilezError::ResourceNotFound(format!(
                    "Storage location not found for id: {}",
                    id
                )),
                _ => FilezError::from(e),
            })?;

        Ok(storage_location)
    }

    pub async fn initialize_provider(&self) -> Result<StorageProvider, FilezError> {
        Ok(StorageProvider::initialize(&self.provider_config, &self.id.to_string()).await?)
    }

    pub async fn get_content(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<axum::body::Body, FilezError> {
        let provider = self.initialize_provider().await?;
        Ok(provider.get_content(full_file_path, timing, range).await?)
    }

    pub async fn get_file_size(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, FilezError> {
        let provider = self.initialize_provider().await?;
        Ok(provider.get_file_size(full_file_path, timing).await?)
    }

    pub async fn update_content(
        &self,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        request: Request,
        mime_type: &str,
        offset: u64,
        length: u64,
    ) -> Result<(), FilezError> {
        let provider = self.initialize_provider().await?;
        Ok(provider
            .update_content(full_file_path, timing, request, mime_type, offset, length)
            .await?)
    }
}
