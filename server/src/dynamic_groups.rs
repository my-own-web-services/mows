use crate::{db::DB, retry_transient_transaction_error};
use filez_common::server::{FilezFile, FilezFileGroup, FilterRuleType};
use regex::Regex;
use serde_json::Value;

pub enum UpdateType {
    Group(Vec<FilezFileGroup>),
    Files(Vec<FilezFile>),
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
    match update_type {
        UpdateType::Group(groups) => {
            let current_files = db.get_files_by_owner_id(requesting_user_id).await?;

            let mut changes = vec![];
            for group in groups {
                let changess = handle_group_change(group, &current_files);
                changes.extend(changess);
            }
            retry_transient_transaction_error!(
                db.update_dynamic_file_groups_on_many_files(&changes).await
            );
        }
        UpdateType::Files(files) => {
            let possible_groups = db
                .get_dynamic_groups_by_owner_id(requesting_user_id)
                .await?;

            let mut changes = vec![];
            for file in files {
                if let Some(group_change) =
                    handle_file_change(file, &possible_groups.iter().collect())
                {
                    changes.push(group_change);
                }
            }

            retry_transient_transaction_error!(
                db.update_dynamic_file_groups_on_many_files(&changes).await
            );
        }
    }
    Ok(())
}

/*
a dynamic groups filter was changed: this might affect any file by the same owner
so every file needs to be checked against the changed group
 N Files, 1 Group

 for file in files
    handle_file_change(file, group)

*/

pub fn handle_group_change(group: &FilezFileGroup, files: &Vec<FilezFile>) -> Vec<GroupChange> {
    let mut group_changes = vec![];

    for file in files {
        if let Some(group_change) = handle_file_change(file, &vec![group]) {
            group_changes.push(group_change);
        }
    }
    group_changes
}

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
    possible_groups: &Vec<&FilezFileGroup>,
) -> Option<GroupChange> {
    let mut added_groups = vec![];
    let mut removed_groups = vec![];

    for group in possible_groups {
        if check_match(changed_file, group) {
            if !changed_file
                .dynamic_file_group_ids
                .contains(&group.file_group_id)
            {
                added_groups.push(group.file_group_id.clone());
            }
        } else if changed_file
            .dynamic_file_group_ids
            .contains(&group.file_group_id)
        {
            removed_groups.push(group.file_group_id.clone());
        }
    }

    if added_groups.is_empty() && removed_groups.is_empty() {
        return None;
    }

    Some(GroupChange {
        file_id: changed_file.file_id.clone(),
        added_groups,
        removed_groups,
    })
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
