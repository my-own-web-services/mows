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
#[diesel(table_name = crate::schema::user_user_group_members)]
#[diesel(check_for_backend(Pg))]
pub struct UserUserGroupMember {
    pub user_id: Uuid,
    pub user_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

impl UserUserGroupMember {
    pub fn new(user_id: &Uuid, user_group_id: &Uuid) -> Self {
        Self {
            user_id: user_id.clone(),
            user_group_id: user_group_id.clone(),
            created_time: chrono::Utc::now().naive_utc(),
        }
    }
}