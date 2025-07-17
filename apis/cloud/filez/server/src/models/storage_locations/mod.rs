use std::{collections::HashMap, sync::Arc};

use crate::{
    api::{health::HealthStatus, storage_locations::list::ListStorageLocationsSortBy},
    controller::crd::SecretReadableByFilezController,
    errors::FilezError,
    state::StorageLocationState,
    storage::{
        config::{StorageProviderConfig, StorageProviderConfigCrd},
        providers::StorageProvider,
    },
    types::SortDirection,
    utils::get_uuid,
};
use axum::extract::Request;
use bigdecimal::BigDecimal;
use diesel::{pg::Pg, prelude::*};
use diesel_async::RunQueryDsl;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
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
    pub id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, JsonSchema, PartialEq, Eq)]
pub struct StorageLocationConfigCrd {
    pub provider_config: StorageProviderConfigCrd,
}

impl StorageLocation {
    pub async fn get_all_storage_locations_health(
        storage_location_providers: &StorageLocationState,
    ) -> Result<HashMap<Uuid, HealthStatus>, FilezError> {
        let providers = storage_location_providers.read().await;
        let mut health_map = HashMap::new();
        for (id, provider) in providers.iter() {
            health_map.insert(*id, provider.get_health().await);
        }

        Ok(health_map)
    }

    pub async fn delete(
        storage_location_providers: &StorageLocationState,
        db: &crate::db::Db,
        name: &str,
    ) -> Result<(), FilezError> {
        let mut connection = db.pool.get().await?;

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

    pub async fn delete_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        full_file_path: &str,
        timing: &axum_server_timing::ServerTimingExtension,
    ) -> Result<(), FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider.delete_content(full_file_path, timing).await?)
    }

    pub async fn create_or_update(
        storage_location_providers_state: &StorageLocationState,
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

        let location_id = match existing_storage_location {
            Some(mut storage_location) => {
                storage_location.modified_time = chrono::Local::now().naive_local();

                storage_location.provider_config = provider.clone();
                diesel::update(crate::schema::storage_locations::table)
                    .filter(crate::schema::storage_locations::id.eq(storage_location.id))
                    .set(&storage_location)
                    .execute(&mut connection)
                    .await?;
                storage_location.id
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

    pub async fn initialize_all_providers(
        db: &crate::db::Db,
    ) -> Result<StorageLocationState, FilezError> {
        let mut connection = db.pool.get().await?;
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

    pub async fn list(
        db: &crate::db::Db,
        sort_by: Option<ListStorageLocationsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<StorageLocationListItem>, FilezError> {
        let mut connection = db.pool.get().await?;
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

    pub async fn get_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,
        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        range: &Option<(Option<u64>, Option<u64>)>,
    ) -> Result<axum::body::Body, FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider.get_content(full_file_path, timing, range).await?)
    }

    pub async fn get_file_size(
        &self,
        storage_locations_provider_state: &StorageLocationState,

        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
    ) -> Result<BigDecimal, FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider.get_file_size(full_file_path, timing).await?)
    }

    pub async fn update_content(
        &self,
        storage_locations_provider_state: &StorageLocationState,

        full_file_path: &str,
        timing: axum_server_timing::ServerTimingExtension,
        request: Request,
        mime_type: &str,
        offset: u64,
        length: u64,
    ) -> Result<(), FilezError> {
        let provider = self
            .get_provider_from_state(storage_locations_provider_state)
            .await?;
        Ok(provider
            .update_content(full_file_path, timing, request, mime_type, offset, length)
            .await?)
    }
}
