use super::user::FilezUser;
use crate::utils::generate_id;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// file groups are just selectors for files
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezFileGroup {
    #[serde(rename = "_id")]
    pub file_group_id: String,
    pub name: Option<String>,
    /** Id of the User owning the file group*/
    pub owner_id: String,
    /**
    List of permission ids for this file group
    The Permissions will be merged and then evaluated
     */
    pub permission_ids: Vec<String>,
    pub keywords: Vec<String>,
    pub mime_types: Vec<String>,
    /**
     * Paths that allows the user to create a hierarchy of file groups
     */
    pub group_hierarchy_paths: Vec<String>,
    pub group_type: FileGroupType,
    pub dynamic_group_rules: Option<FilterRule>,
    pub item_count: u32,
    pub deletable: bool,
    pub readonly: bool,
    pub all: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilterRule {
    pub field: String,
    pub rule_type: FilterRuleType,
    pub value: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilterRuleType {
    MatchRegex,
    NotMatchRegex,
    Contains,
    NotContains,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FileGroupType {
    Static,
    Dynamic,
}

impl FilezFileGroup {
    pub fn new(owner: &FilezUser, group_type: FileGroupType, name: Option<String>) -> Self {
        let file_group_id = generate_id(16);

        Self {
            file_group_id,
            name,
            owner_id: owner.user_id.clone(),
            permission_ids: vec![],
            keywords: vec![],
            mime_types: vec![],
            group_hierarchy_paths: vec![],
            group_type,
            dynamic_group_rules: None,
            item_count: 0,
            deletable: true,
            readonly: false,
            all: false,
        }
    }
    pub fn new_all_group(owner: &FilezUser) -> Self {
        let file_group_id = generate_id(16);

        Self {
            file_group_id,
            name: Some("All".to_string()),
            owner_id: owner.user_id.clone(),
            permission_ids: vec![],
            keywords: vec![],
            mime_types: vec![],
            group_hierarchy_paths: vec![],
            group_type: FileGroupType::Static,
            dynamic_group_rules: None,
            item_count: 0,
            deletable: false,
            readonly: true,
            all: true,
        }
    }

    pub fn make_undeleatable(&mut self) {
        self.deletable = false;
    }

    pub fn make_all_group(&mut self) {
        self.all = true;
    }

    pub fn make_readonly(&mut self) {
        self.readonly = true;
    }
}
