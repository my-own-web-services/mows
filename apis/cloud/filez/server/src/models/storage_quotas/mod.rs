use bigdecimal::BigDecimal;
use diesel::{
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    query_dsl::methods::{FilterDsl, SelectDsl},
    BoolExpressionMethods, ExpressionMethods, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    api::storage_quotas::list::ListStorageQuotasSortBy, db::Db, errors::FilezError, schema,
    types::SortDirection,
};

use super::access_policies::AccessPolicySubjectType;

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
    #[diesel(sql_type = diesel::sql_types::SmallInt)]
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,

    #[schema(value_type=i64)]
    pub quota_bytes: BigDecimal,
    pub ignore_quota: bool,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl StorageQuota {
    pub fn new(
        subject_type: AccessPolicySubjectType,
        subject_id: Uuid,
        storage_location_id: Uuid,
        quota_bytes: BigDecimal,
        ignore_quota: bool,
    ) -> Self {
        Self {
            subject_type,
            subject_id,
            storage_location_id,
            quota_bytes,
            ignore_quota,
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

    pub async fn list_with_user_access(
        db: &Db,
        requesting_user_id: &Uuid,
        app_id: &Uuid,
        from_index: Option<i64>,
        limit: Option<i64>,
        sort_by: Option<ListStorageQuotasSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<StorageQuota>, FilezError> {
        todo!();
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
        ignore_quota: bool,
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
            schema::storage_quotas::ignore_quota.eq(ignore_quota),
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
