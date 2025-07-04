pub mod errors;

use diesel::{
    pg::Pg,
    prelude::{Associations, Insertable, Queryable},
    Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::{file_groups::FileGroup, files::FilezFile};

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Associations, Insertable, Debug,
)]
#[diesel(table_name = crate::schema::file_file_group_members)]
#[diesel(belongs_to(FilezFile, foreign_key = file_id))]
#[diesel(belongs_to(FileGroup, foreign_key = file_group_id))]
#[diesel(primary_key(file_id, file_group_id))]
#[diesel(check_for_backend(Pg))]
pub struct FileFileGroupMember {
    pub file_id: Uuid,
    pub file_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

impl FileFileGroupMember {
    pub fn new(file_id: Uuid, file_group_id: Uuid) -> Self {
        Self {
            file_id,
            file_group_id,
            created_time: chrono::Utc::now().naive_utc(),
        }
    }
}
