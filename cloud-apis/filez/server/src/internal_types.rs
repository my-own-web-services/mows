use crate::interossea::UserAssertion;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_ir_user_id: Option<String>,
    pub password: Option<String>,
    pub user_assertion: Option<UserAssertion>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct GetItemListResponseBody<T> {
    pub items: Vec<T>,
    pub total_count: u32,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct GetItemListRequestBody {
    #[ts(optional)]
    pub id: Option<String>,
    #[ts(type = "number", optional)]
    pub from_index: Option<u64>,
    #[ts(type = "number", optional)]
    pub limit: Option<u64>,
    #[ts(optional)]
    pub sort_field: Option<String>,
    #[ts(optional)]
    pub sort_order: Option<SortOrder>,
    #[ts(optional)]
    pub filter: Option<String>,
    #[ts(optional)]
    pub sub_resource_type: Option<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum SortOrder {
    Ascending,
    Descending,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FileResourceType {
    FileGroup,
    File,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum AppDataType {
    File,
    User,
}
