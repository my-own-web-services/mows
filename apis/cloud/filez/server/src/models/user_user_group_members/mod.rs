use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    AsChangeset, Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    models::{user_groups::UserGroupId, users::FilezUserId},
    utils::get_current_timestamp,
};

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug, AsChangeset,
)]
#[diesel(table_name = crate::schema::user_user_group_members)]
#[diesel(check_for_backend(Pg))]
pub struct UserUserGroupMember {
    pub user_id: FilezUserId,
    pub user_group_id: UserGroupId,
    pub created_time: chrono::NaiveDateTime,
}

impl UserUserGroupMember {
    pub fn new(user_id: &FilezUserId, user_group_id: &UserGroupId) -> Self {
        Self {
            user_id: user_id.clone(),
            user_group_id: user_group_id.clone(),
            created_time: get_current_timestamp(),
        }
    }
}
