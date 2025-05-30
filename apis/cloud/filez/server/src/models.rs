use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone)]
#[diesel(table_name = crate::schema::files)]
pub struct File {
    pub file_id: Uuid,
    pub owner_id: Uuid,
    pub mime_type: String,
    pub file_name: String,
    pub created_at: chrono::NaiveDateTime,
}
