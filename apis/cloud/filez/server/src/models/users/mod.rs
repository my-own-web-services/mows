pub mod errors;

use bigdecimal::BigDecimal;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::utils::get_uuid;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct FilezUser {
    pub id: Uuid,
    pub external_user_id: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    #[schema(value_type=i64)]
    pub storage_limit: BigDecimal,
}

impl FilezUser {
    pub fn new(external_user_id: Option<String>, display_name: &str, storage_limit: i64) -> Self {
        Self {
            id: get_uuid(),
            external_user_id,
            display_name: display_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            deleted: false,
            storage_limit: BigDecimal::from(storage_limit),
        }
    }
}
