use chrono::NaiveDateTime;

use crate::models::{apps::MowsAppId, users::FilezUserId};

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct SessionInfo {
    pub user_id: FilezUserId,
    pub app_id: MowsAppId,
    pub last_seen: NaiveDateTime,
}
