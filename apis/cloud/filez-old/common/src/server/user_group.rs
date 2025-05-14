use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UserGroupVisibility {
    Public,
    Private,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezUserGroup {
    #[serde(rename = "_id")]
    pub user_group_id: String,
    pub name: Option<String>,
    /** Id of the User owning the user group*/
    pub owner_id: String,

    pub visibility: UserGroupVisibility,
    pub permission_ids: Vec<String>,
}
