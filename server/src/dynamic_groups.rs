use crate::db::DB;
use filez_common::server::{FilezFile, FilezFileGroup, FilterRuleType};
use regex::Regex;
use serde_json::Value;

pub enum UpdateType {
    Group(FilezFileGroup),
    File(FilezFile),
}

pub async fn handle_dynamic_group_update(db: &DB, update_type: &UpdateType) -> anyhow::Result<()> {
    match update_type {
        UpdateType::Group(group) => {
            let current_files = db.get_files_by_owner_id(&group.owner_id).await?;

            dbg!(current_files.len());

            let files_to_be_updated = handle_group_change(group, &current_files);

            dbg!(&files_to_be_updated);

            db.update_file_groups_on_many_files(&files_to_be_updated)
                .await?;
        }
        UpdateType::File(file) => {
            let groups = db.get_dynamic_groups_by_owner_id(&file.owner_id).await?;

            let new_groups = handle_file_change(file, &groups.iter().collect());

            let _files_to_be_updated = vec![(file.file_id.clone(), new_groups)];

            // TODO update stuff
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

pub fn handle_group_change(
    group: &FilezFileGroup,
    files: &Vec<FilezFile>,
) -> Vec<(String, Vec<String>)> {
    let mut files_and_new_groups = vec![];

    for file in files {
        let res = handle_file_change(file, &vec![group]);
        files_and_new_groups.push((file.file_id.clone(), res));
    }
    files_and_new_groups
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
) -> Vec<String> {
    let mut files_new_groups = vec![];

    for group in possible_groups {
        if check_match(changed_file, group) {
            files_new_groups.push(group.file_group_id.clone());
        };
    }

    files_new_groups
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
    }
}

pub fn check_rule_match_regex(changed_file: &FilezFile, field: &str, regex: &str) -> bool {
    let field_value =
        match get_field_value_by_object_path(&serde_json::to_value(changed_file).unwrap(), field) {
            Some(v) => v,
            None => return false,
        };
    dbg!(&field_value);
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
/*
MatchRegex: string, bool, number
NotMatchRegex: string, bool, number
Contains: string, array
NotContains: string, array
Equals: string, bool, number
NotEquals: string, bool, number
*/
