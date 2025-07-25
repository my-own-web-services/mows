use diesel::{
    pg::Pg,
    prelude::{AsChangeset, Insertable, Queryable, QueryableByName},
    Selectable,
};
use diesel_as_jsonb::AsJsonb;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

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
#[diesel(table_name = crate::schema::jobs)]
#[diesel(check_for_backend(Pg))]
pub struct FilezJob {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub app_id: Uuid,
    pub name: String,
    pub status: JobStatus,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub start_time: Option<chrono::NaiveDateTime>,
    pub end_time: Option<chrono::NaiveDateTime>,
}

#[derive(Serialize, Deserialize, AsJsonb, ToSchema, Clone, Debug)]
pub struct JobStatus {}
