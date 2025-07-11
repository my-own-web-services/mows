use bigdecimal::BigDecimal;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    Selectable,
};
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
#[diesel(table_name = crate::schema::storage_quotas)]
#[diesel(check_for_backend(Pg))]
pub struct StorageQuota {
    pub subject_type: String,
    pub subject_id: Uuid,
    pub storage_location_id: Uuid,

    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    #[schema(value_type=i64)]
    pub quota_bytes: BigDecimal,

    pub ignore_quota: bool,
}
