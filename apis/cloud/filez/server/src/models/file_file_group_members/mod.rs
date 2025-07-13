use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    AsChangeset, Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug, AsChangeset,
)]
#[diesel(table_name = crate::schema::file_file_group_members)]
#[diesel(check_for_backend(Pg))]
pub struct FileFileGroupMember {
    pub file_id: Uuid,
    pub file_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

impl FileFileGroupMember {
    pub fn new(file_id: &Uuid, file_group_id: &Uuid) -> Self {
        Self {
            file_id: file_id.clone(),
            file_group_id: file_group_id.clone(),
            created_time: chrono::Utc::now().naive_utc(),
        }
    }
}