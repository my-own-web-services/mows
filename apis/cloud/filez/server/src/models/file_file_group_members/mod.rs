use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    AsChangeset, Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    models::{file_groups::FileGroupId, files::FilezFileId},
    utils::get_current_timestamp,
};

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug, AsChangeset,
)]
#[diesel(table_name = crate::schema::file_file_group_members)]
#[diesel(check_for_backend(Pg))]
pub struct FileFileGroupMember {
    pub file_id: FilezFileId,
    pub file_group_id: FileGroupId,
    pub created_time: chrono::NaiveDateTime,
}

impl FileFileGroupMember {
    #[tracing::instrument(level = "trace")]
    pub fn new(file_id: &FilezFileId, file_group_id: &FileGroupId) -> Self {
        Self {
            file_id: file_id.clone(),
            file_group_id: file_group_id.clone(),
            created_time: get_current_timestamp(),
        }
    }
}
