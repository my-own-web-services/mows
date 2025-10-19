use std::{collections::HashMap, sync::Arc};

use crate::{
    controller::crd::SecretReadableByFilezController,
    database::Database,
    errors::FilezError,
    http_api::{health::HealthStatus, storage_locations::list::ListStorageLocationsSortBy},
    impl_typed_uuid,
    models::file_versions::ContentRange,
    state::StorageLocationState,
    storage::{
        config::{StorageProviderConfig, StorageProviderConfigCrd},
        providers::StorageProvider,
    },
    types::SortDirection,
    utils::get_current_timestamp,
};
use axum::extract::Request;
use diesel::{pg::Pg, prelude::*};
use diesel_async::RunQueryDsl;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use utoipa::ToSchema;

use super::file_versions::FileVersionIdentifier;

impl_typed_uuid!(StorageLocationId);

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
    pub id: StorageLocationId,
    pub name: String,
    pub provider_config: StorageProviderConfig,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(
    Serialize,
    Deserialize,
    Queryable,
    Selectable,
    ToSchema,
    Clone,
    Debug,
    QueryableByName,
    AsChangeset,
)]
#[diesel(table_name = crate::schema::storage_locations)]
#[diesel(check_for_backend(Pg))]
pub struct StorageLocationListItem {
    pub id: StorageLocationId,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageLocationConfigCrd {
    pub provider_config: StorageProviderConfigCrd,
    pub default_quotas: Vec<DefaultQuota>,
}

// TODO: implement default quotas

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DefaultQuota {
    DefaultUserQuota(DefaultUserQuota),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
/// A default quota that gets applied to all users for a storage location.
pub struct DefaultUserQuota {
    pub name: String,
    pub max_size_bytes: u64,
}

impl StorageLocation {
    #[tracing::instrument(level = "trace")]
    pub fn new(name: &str, provider_config: StorageProviderConfig) -> Self {
        Self {
            id: StorageLocationId::new(),
            name: name.to_string(),
            provider_config,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
        }
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_all_storage_locations_health(
        storage_location_providers: &StorageLocationState,
    ) -> HashMap<StorageLocationId, HealthStatus> {
        let providers = storage_location_providers.read().await;

        let mut provider_ids = Vec::new();
        let mut get_health_futures: Vec<_> = Vec::new();

        for (id, provider) in providers.iter() {
            provider_ids.push(*id);
            get_health_futures.push(provider.get_health());
        }

        let get_health_results = futures::future::join_all(get_health_futures).await;
        let mut health_map = HashMap::new();
        for (id, provider) in provider_ids.iter().zip(get_health_results.iter()) {
            health_map.insert(*id, provider.clone());
        }

        health_map
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete(
        storage_location_providers: &StorageLocationState,
        database: &Database,
        name: &str,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;

        let storage_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::name.eq(name))
            .select(StorageLocation::as_select())
            .first::<StorageLocation>(&mut connection)
            .await?;

        diesel::delete(crate::schema::storage_locations::table)
            .filter(crate::schema::storage_locations::name.eq(name))
            .execute(&mut connection)
            .await?;

        let mut providers = storage_location_providers.write().await;
        providers.remove(&storage_location.id);

        Ok(())
    }

    #[tracing::instrument(level = "trace")]
    pub async fn delete_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        file_version_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider
            .delete_content(file_version_identifier, timing)
            .await?)
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_content_sha256_digest(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        file_version_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<String, FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider
            .get_content_sha256_digest(file_version_identifier, timing)
            .await?)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_or_update(
        storage_location_providers_state: &StorageLocationState,
        database: &Database,
        full_name: &str,
        secrets: SecretReadableByFilezController,
        storage_location_config_crd: &StorageLocationConfigCrd,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;

        let provider = storage_location_config_crd
            .provider_config
            .convert_secrets(secrets)?;

        let existing_storage_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::name.eq(full_name))
            .select(StorageLocation::as_select())
            .first::<StorageLocation>(&mut connection)
            .await
            .ok();

        let location_id = match existing_storage_location {
            Some(mut storage_location) => {
                storage_location.modified_time = get_current_timestamp();

                storage_location.provider_config = provider.clone();
                diesel::update(crate::schema::storage_locations::table)
                    .filter(crate::schema::storage_locations::id.eq(storage_location.id))
                    .set(&storage_location)
                    .execute(&mut connection)
                    .await?;
                storage_location.id
            }
            None => {
                let new_storage_location = StorageLocation::new(full_name, provider.clone());
                diesel::insert_into(crate::schema::storage_locations::table)
                    .values(&new_storage_location)
                    .execute(&mut connection)
                    .await?;
                new_storage_location.id
            }
        };

        let provider = StorageProvider::initialize(&provider, &location_id.to_string()).await?;
        {
            let mut providers = storage_location_providers_state.write().await;
            providers.insert(location_id, provider);
        }

        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_by_id(
        database: &Database,
        storage_location_id: &StorageLocationId,
    ) -> Result<Self, FilezError> {
        let mut connection = database.get_connection().await?;

        let storage_location = crate::schema::storage_locations::table
            .filter(crate::schema::storage_locations::id.eq(storage_location_id))
            .select(StorageLocation::as_select())
            .first::<StorageLocation>(&mut connection)
            .await
            .map_err(|e| match e {
                diesel::result::Error::NotFound => FilezError::ResourceNotFound(format!(
                    "Storage location not found for id: {}",
                    storage_location_id
                )),
                _ => FilezError::from(e),
            })?;

        Ok(storage_location)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn initialize_all_providers(
        database: &Database,
    ) -> Result<StorageLocationState, FilezError> {
        let mut connection = database.get_connection().await?;
        let storage_locations: Vec<StorageLocation> = crate::schema::storage_locations::table
            .select(StorageLocation::as_select())
            .load(&mut connection)
            .await?;

        let mut storage_providers = HashMap::new();

        for storage_location in storage_locations {
            let provider = StorageProvider::initialize(
                &storage_location.provider_config,
                &storage_location.id.to_string(),
            )
            .await?;
            storage_providers.insert(storage_location.id, provider);
        }

        Ok(Arc::new(RwLock::new(storage_providers)))
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list(
        database: &Database,
        sort_by: Option<ListStorageLocationsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<StorageLocationListItem>, FilezError> {
        let mut connection = database.get_connection().await?;
        let mut query = crate::schema::storage_locations::table.into_boxed();

        if let Some(sort_by) = sort_by {
            match sort_by {
                ListStorageLocationsSortBy::CreatedTime => {
                    query = match sort_order {
                        Some(SortDirection::Ascending) => {
                            query.order(crate::schema::storage_locations::created_time.asc())
                        }
                        _ => query.order(crate::schema::storage_locations::created_time.desc()),
                    };
                }
                ListStorageLocationsSortBy::ModifiedTime => {
                    query = match sort_order {
                        Some(SortDirection::Ascending) => {
                            query.order(crate::schema::storage_locations::modified_time.asc())
                        }
                        _ => query.order(crate::schema::storage_locations::modified_time.desc()),
                    };
                }
                ListStorageLocationsSortBy::Name => {
                    query = match sort_order {
                        Some(SortDirection::Ascending) => {
                            query.order(crate::schema::storage_locations::name.asc())
                        }
                        _ => query.order(crate::schema::storage_locations::name.desc()),
                    };
                }
            }
        }

        let storage_locations = query
            .select(StorageLocationListItem::as_select())
            .load::<StorageLocationListItem>(&mut connection)
            .await?;

        Ok(storage_locations)
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_provider_from_state(
        &self,
        storage_locations_provider_state: &StorageLocationState,
    ) -> Result<StorageProvider, FilezError> {
        let providers = storage_locations_provider_state.read().await;
        providers
            .get(&self.id)
            .cloned()
            .ok_or(FilezError::ResourceNotFound(format!(
                "Storage provider not found for storage location: {}",
                self.name
            )))
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        file_version_identifier: &FileVersionIdentifier,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<ContentRange>,
    ) -> Result<axum::body::Body, FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider
            .get_content(file_version_identifier, timing, range)
            .await?)
    }

    #[tracing::instrument(level = "trace")]
    pub async fn get_file_size(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        file_version_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<u64, FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider
            .get_file_size(file_version_identifier, timing)
            .await?)
    }

    #[tracing::instrument(level = "trace")]
    pub async fn set_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        file_version_identifier: &FileVersionIdentifier,
        timing: &axum_server_timing::ServerTimingExtension,
        request: Request,
        mime_type: &str,
        offset: u64,
        length: u64,
    ) -> Result<(), FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider
            .set_content(
                file_version_identifier,
                timing,
                request,
                mime_type,
                offset,
                length,
            )
            .await?)
    }
}
