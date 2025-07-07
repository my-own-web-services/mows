use std::fs::File;

use diesel::{
    pg::Pg,
    prelude::{Associations, Insertable, Queryable, QueryableByName},
    Selectable,
};
use minio::s3::types::Tag;
use uuid::Uuid;

#[derive(Queryable, Selectable, Clone, Insertable, Debug, Associations, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::file_tag_members)]
#[diesel(belongs_to(File, foreign_key = file_id))]
#[diesel(belongs_to(Tag, foreign_key = tag_id))]
pub struct FileTagMember {
    pub file_id: Uuid,
    pub tag_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
    pub created_by_user_id: Uuid,
}

impl FileTagMember {
    pub fn new(file_id: Uuid, tag_id: Uuid, created_by_user_id: Uuid) -> Self {
        Self {
            file_id,
            tag_id,
            created_time: chrono::Utc::now().naive_utc(),
            created_by_user_id,
        }
    }
}
