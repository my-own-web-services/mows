use std::fs::File;

use diesel::{
    pg::Pg,
    prelude::{Associations, Insertable, Queryable},
    Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::file_groups::FileGroup;

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Associations, Insertable, Debug,
)]
#[diesel(table_name = crate::schema::user_user_group_members)]
#[diesel(belongs_to(File, foreign_key = user_id))]
#[diesel(belongs_to(FileGroup, foreign_key = user_group_id))]
#[diesel(primary_key(user_id, user_group_id))]
#[diesel(check_for_backend(Pg))]
pub struct UserUserGroupMember {
    pub user_id: Uuid,
    pub user_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

impl UserUserGroupMember {
    pub fn new(user_id: Uuid, user_group_id: Uuid) -> Self {
        Self {
            user_id,
            user_group_id,
            created_time: chrono::Utc::now().naive_utc(),
        }
    }
}
