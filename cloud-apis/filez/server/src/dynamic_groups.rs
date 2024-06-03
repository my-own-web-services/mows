use crate::{db::DB, retry_transient_transaction_error};
use filez_common::server::{
    file::FilezFile,
    file_group::{FileGroupType, FilezFileGroup, FilterRuleType},
};
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;

pub enum UpdateType {
    Group(Vec<FilezFileGroup>),
    Files((Vec<FilezFile>, Option<String>)),
}

#[derive(Debug, Clone)]
pub struct GroupChange {
    pub file_id: String,
    pub added_groups: Vec<String>,
    pub removed_groups: Vec<String>,
}

pub async fn handle_dynamic_group_update(
    db: &DB,
    update_type: &UpdateType,
    requesting_user_id: &str,
) -> anyhow::Result<()> {
    let mut file_ids_by_single_group_to_be_added: HashMap<String, Vec<String>> = HashMap::new();
    let mut file_ids_by_single_group_to_be_removed: HashMap<String, Vec<String>> = HashMap::new();

    match update_type {
        UpdateType::Group(groups) => {
            // a dynamic group was changed: this might affect any file by the same owner
            let current_files = db.get_files_by_owner_id(requesting_user_id).await?;

            for group in groups {
                for file in &current_files {
                    handle_file_change(
                        file,
                        &vec![group.clone()],
                        &mut file_ids_by_single_group_to_be_added,
                        &mut file_ids_by_single_group_to_be_removed,
                    );
                }
            }
        }
        UpdateType::Files((files, changed_field)) => {
            // files changed that might be affected by dynamic groups
            let possible_groups = db
                .get_dynamic_groups_by_owner_id(requesting_user_id)
                .await?;

            let possible_groups = if let Some(changed_field) = changed_field {
                possible_groups
                    .into_iter()
                    .filter(|g| check_group_rule_includes_changed_field(g, changed_field))
                    .collect::<Vec<_>>()
            } else {
                possible_groups
            };

            // TODO OPTIMIZE: filter out groups that have a rule that can't ever match the file because of the changed field
            // not that important as this only skips the fast checks done by rust, but not the slow db update

            for file in files {
                handle_file_change(
                    file,
                    &possible_groups,
                    &mut file_ids_by_single_group_to_be_added,
                    &mut file_ids_by_single_group_to_be_removed,
                );
            }
        }
    }

    retry_transient_transaction_error!(
        db.update_files_and_file_groups(
            &file_ids_by_single_group_to_be_added,
            &file_ids_by_single_group_to_be_removed,
            FileGroupType::Dynamic
        )
        .await
    );
    Ok(())
}

fn check_group_rule_includes_changed_field(group: &FilezFileGroup, changed_field: &str) -> bool {
    match &group.dynamic_group_rules {
        Some(rule) => rule.field == changed_field,
        None => false,
    }
}

/*
a dynamic groups filter was changed: this might affect any file by the same owner
so every file needs to be checked against the changed group
 N Files, 1 Group

 for file in files
    handle_file_change(file, group)

*/

/*
a files database data was changed: this might change its group membership
involved are the file and all dynamic groups
only the files dynamic groups need to be updated
the file is checked against the rules of all dynamic groups by the same owner
1 File, N Groups

for group in groups
    check
*/
/**
returns the groups to be set on the file
*/
pub fn handle_file_change(
    changed_file: &FilezFile,
    possible_groups: &Vec<FilezFileGroup>,
    file_ids_by_single_group_to_be_added: &mut HashMap<String, Vec<String>>,
    file_ids_by_single_group_to_be_removed: &mut HashMap<String, Vec<String>>,
) {
    for group in possible_groups {
        if check_match(changed_file, group) {
            let already_in_group = changed_file
                .dynamic_file_group_ids
                .contains(&group.file_group_id);
            if !already_in_group {
                file_ids_by_single_group_to_be_added
                    .entry(group.file_group_id.clone())
                    .or_default()
                    .push(changed_file.file_id.clone());
            }
        } else {
            let currently_in_group = changed_file
                .dynamic_file_group_ids
                .contains(&group.file_group_id);
            if currently_in_group {
                file_ids_by_single_group_to_be_removed
                    .entry(group.file_group_id.clone())
                    .or_default()
                    .push(changed_file.file_id.clone());
            }
        }
    }
}

pub fn check_match(changed_file: &FilezFile, possible_group: &FilezFileGroup) -> bool {
    let rule = match &possible_group.dynamic_group_rules {
        Some(rule) => rule,
        None => return false,
    };

    match rule.rule_type {
        FilterRuleType::MatchRegex => {
            check_rule_match_regex(changed_file, &rule.field, &rule.value)
        }
        FilterRuleType::NotMatchRegex => {
            !check_rule_match_regex(changed_file, &rule.field, &rule.value)
        }
        FilterRuleType::Contains => check_rule_contains(changed_file, &rule.field, &rule.value),
        FilterRuleType::NotContains => !check_rule_contains(changed_file, &rule.field, &rule.value),
    }
}

pub fn check_rule_contains(changed_file: &FilezFile, field: &str, value: &str) -> bool {
    let field_value =
        match get_field_value_by_object_path(&serde_json::to_value(changed_file).unwrap(), field) {
            Some(v) => v,
            None => return false,
        };
    //dbg!(&field_value);

    match field_value {
        Value::String(s) => s.contains(value),
        Value::Array(a) => a.contains(&Value::String(value.to_string())),
        Value::Number(n) => n.to_string().contains(value),
        Value::Bool(b) => b.to_string().contains(value),
        _ => false,
    }
}

pub fn check_rule_match_regex(changed_file: &FilezFile, field: &str, regex: &str) -> bool {
    let field_value =
        match get_field_value_by_object_path(&serde_json::to_value(changed_file).unwrap(), field) {
            Some(v) => v,
            None => return false,
        };
    //dbg!(&field_value);
    let parsed_regex = match Regex::new(regex) {
        Ok(v) => v,
        Err(e) => {
            println!("Error parsing regex: {}", e);
            return false;
        }
    };

    match field_value {
        Value::String(s) => parsed_regex.is_match(&s),
        Value::Number(n) => parsed_regex.is_match(&n.to_string()),
        Value::Bool(b) => parsed_regex.is_match(&b.to_string()),
        _ => false,
    }
}

pub fn get_field_value_by_object_path(object: &Value, path: &str) -> Option<Value> {
    let mut current_object = object;
    for part in path.split('.') {
        current_object = match current_object.get(part) {
            Some(v) => v,
            None => return None,
        };
    }

    Some(current_object.clone())
}
