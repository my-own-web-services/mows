use bigdecimal::BigDecimal;
use diesel::{prelude::*, AsChangeset};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    api::storage_quotas::list::ListStorageQuotasSortBy, db::Db, errors::FilezError, schema,
    types::SortDirection, utils::get_uuid,
};

use super::{access_policies::AccessPolicySubjectType, user_groups::UserGroup};

#[macro_export]
macro_rules! filter_subject_storage_quotas {
    ($requesting_user_id:expr, $user_group_ids:expr) => {
        schema::storage_quotas::subject_type
            .eq(AccessPolicySubjectType::User)
            .and(schema::storage_quotas::subject_id.eq($requesting_user_id))
            .or(schema::storage_quotas::subject_type
                .eq(AccessPolicySubjectType::UserGroup)
                .and(schema::storage_quotas::subject_id.eq_any($user_group_ids)))
    };
}

#[derive(
    Queryable,
    Selectable,
    Insertable,
    Clone,
    Debug,
    Serialize,
    Deserialize,
    ToSchema,
    AsChangeset,
    QueryableByName,
)]
#[diesel(table_name = crate::schema::storage_quotas)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct StorageQuota {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    #[diesel(sql_type = diesel::sql_types::SmallInt)]
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,

    #[schema(value_type=i64)]
    pub quota_bytes: BigDecimal,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl StorageQuota {
    pub fn new(
        owner_id: Uuid,
        name: String,
        subject_type: AccessPolicySubjectType,
        subject_id: Uuid,
        storage_location_id: Uuid,
        quota_bytes: BigDecimal,
    ) -> Self {
        Self {
            id: get_uuid(),
            name,
            owner_id,
            subject_type,
            subject_id,
            storage_location_id,
            quota_bytes,
            created_time: chrono::Local::now().naive_local(),
            modified_time: chrono::Local::now().naive_local(),
        }
    }

    pub async fn create(db: &Db, storage_quota: &StorageQuota) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::insert_into(schema::storage_quotas::table)
            .values(storage_quota)
            .execute(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn get_storage_location_id(
        db: &Db,
        storage_quota_id: &Uuid,
    ) -> Result<Uuid, FilezError> {
        let mut conn = db.pool.get().await?;
        let storage_location_id = schema::storage_quotas::table
            .filter(schema::storage_quotas::id.eq(storage_quota_id))
            .select(schema::storage_quotas::storage_location_id)
            .first::<Uuid>(&mut conn)
            .await?;
        Ok(storage_location_id)
    }

    pub async fn check_quota(
        db: &Db,
        requesting_user_id: &Uuid,
        storage_quota_id: &Uuid,
        size: BigDecimal,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;

        let user_groups = UserGroup::get_all_by_user_id(db, requesting_user_id).await?;
        let storage_quota = schema::storage_quotas::table
            .filter(schema::storage_quotas::id.eq(storage_quota_id))
            .select(StorageQuota::as_select())
            .first::<StorageQuota>(&mut conn)
            .await?;

        if storage_quota.subject_type == AccessPolicySubjectType::User
            && storage_quota.subject_id != *requesting_user_id
        {
            return Err(FilezError::Unauthorized(
                "You do not have access to this storage quota".to_string(),
            ));
        }

        if storage_quota.subject_type == AccessPolicySubjectType::UserGroup
            && !user_groups
                .iter()
                .any(|group_id| *group_id == storage_quota.subject_id)
        {
            return Err(FilezError::Unauthorized(
                "You do not have access to this storage quota".to_string(),
            ));
        }

        // get the sum of the size of all file_versions using this storage quota
        let total_size: BigDecimal = schema::file_versions::table
            .filter(schema::file_versions::storage_quota_id.eq(storage_quota.id))
            .select(diesel::dsl::sum(schema::file_versions::size))
            .first::<Option<BigDecimal>>(&mut conn)
            .await?
            .unwrap_or_else(|| BigDecimal::from(0));

        if total_size.clone() + size > storage_quota.quota_bytes {
            return Err(FilezError::StorageQuotaExceeded(format!(
                "Storage quota exceeded for {}: {} bytes used, {} bytes allowed",
                storage_quota.name, total_size, storage_quota.quota_bytes
            )));
        }

        Ok(())
    }

    pub async fn list_with_user_access(
        db: &Db,
        requesting_user_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<ListStorageQuotasSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<StorageQuota>, FilezError> {
        let mut conn = db.pool.get().await?;

        let user_groups = UserGroup::get_all_by_user_id(db, requesting_user_id).await?;
        // only if the user is subject to an storage quota they have access to it
        let mut query = schema::storage_quotas::table
            .filter(filter_subject_storage_quotas!(
                requesting_user_id,
                user_groups
            ))
            .select(StorageQuota::as_select())
            .into_boxed();

        let sort_by = sort_by.unwrap_or(ListStorageQuotasSortBy::CreatedTime);
        let sort_order = sort_order.unwrap_or(SortDirection::Descending);

        match (sort_by, sort_order) {
            (ListStorageQuotasSortBy::SubjectType, SortDirection::Ascending) => {
                query = query.order_by(schema::storage_quotas::subject_type.asc());
            }
            (ListStorageQuotasSortBy::SubjectType, SortDirection::Descending) => {
                query = query.order_by(schema::storage_quotas::subject_type.desc());
            }
            (ListStorageQuotasSortBy::CreatedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::storage_quotas::created_time.asc());
            }
            (ListStorageQuotasSortBy::CreatedTime, SortDirection::Descending) => {
                query = query.order_by(schema::storage_quotas::created_time.desc());
            }
            (ListStorageQuotasSortBy::ModifiedTime, SortDirection::Ascending) => {
                query = query.order_by(schema::storage_quotas::modified_time.asc());
            }
            (ListStorageQuotasSortBy::ModifiedTime, SortDirection::Descending) => {
                query = query.order_by(schema::storage_quotas::modified_time.desc());
            }
            (ListStorageQuotasSortBy::SubjectId, SortDirection::Ascending) => {
                query = query.order_by(schema::storage_quotas::subject_id.asc());
            }
            (ListStorageQuotasSortBy::SubjectId, SortDirection::Descending) => {
                query = query.order_by(schema::storage_quotas::subject_id.desc());
            }
            (ListStorageQuotasSortBy::StorageLocationId, SortDirection::Ascending) => {
                query = query.order_by(schema::storage_quotas::storage_location_id.asc());
            }
            (ListStorageQuotasSortBy::StorageLocationId, SortDirection::Descending) => {
                query = query.order_by(schema::storage_quotas::storage_location_id.desc());
            }
        };

        if let Some(from_index) = from_index {
            query = query.offset(from_index);
        }
        if let Some(limit) = limit {
            query = query.limit(limit);
        }

        let storage_quotas = query.load::<StorageQuota>(&mut conn).await?;
        Ok(storage_quotas)
    }

    pub async fn get(
        db: &Db,
        subject_type: AccessPolicySubjectType,
        subject_id: &Uuid,
        storage_location_id: &Uuid,
    ) -> Result<StorageQuota, FilezError> {
        let mut conn = db.pool.get().await?;
        let storage_quota = schema::storage_quotas::table
            .filter(
                schema::storage_quotas::subject_type
                    .eq(subject_type)
                    .and(schema::storage_quotas::subject_id.eq(subject_id))
                    .and(schema::storage_quotas::storage_location_id.eq(storage_location_id)),
            )
            .select(StorageQuota::as_select())
            .first::<StorageQuota>(&mut conn)
            .await?;
        Ok(storage_quota)
    }

    pub async fn update(
        db: &Db,
        subject_type: AccessPolicySubjectType,
        subject_id: &Uuid,
        storage_location_id: &Uuid,
        quota_bytes: BigDecimal,
    ) -> Result<StorageQuota, FilezError> {
        let mut conn = db.pool.get().await?;
        let updated_quota = diesel::update(
            schema::storage_quotas::table.filter(
                schema::storage_quotas::subject_type
                    .eq(subject_type)
                    .and(schema::storage_quotas::subject_id.eq(subject_id))
                    .and(schema::storage_quotas::storage_location_id.eq(storage_location_id)),
            ),
        )
        .set((
            schema::storage_quotas::quota_bytes.eq(quota_bytes),
            schema::storage_quotas::modified_time.eq(chrono::Local::now().naive_local()),
        ))
        .returning(StorageQuota::as_select())
        .get_result::<StorageQuota>(&mut conn)
        .await?;
        Ok(updated_quota)
    }

    pub async fn delete(
        db: &Db,
        subject_type: AccessPolicySubjectType,
        subject_id: &Uuid,
        storage_location_id: &Uuid,
    ) -> Result<(), FilezError> {
        let mut conn = db.pool.get().await?;
        diesel::delete(
            schema::storage_quotas::table.filter(
                schema::storage_quotas::subject_type
                    .eq(subject_type)
                    .and(schema::storage_quotas::subject_id.eq(subject_id))
                    .and(schema::storage_quotas::storage_location_id.eq(storage_location_id)),
            ),
        )
        .execute(&mut conn)
        .await?;
        Ok(())
    }
}
