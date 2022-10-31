use anyhow::bail;
use hyper::{Body, Request};
use qstring::QString;
use serde_json::Value;
use std::{path::Path, vec};

use crate::{
    db::DB,
    get_acl,
    internal_types::{Auth, MergedFilezPermission},
    types::{FilezFile, FilezPermission},
};

pub fn generate_id() -> String {
    use rand::Rng;
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const LEN: usize = 32;
    let mut rng = rand::thread_rng();

    (0..LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

fn merge_values(a: &mut Value, b: &Value) {
    match (a, b) {
        (&mut Value::Object(ref mut a), &Value::Object(ref b)) => {
            for (k, v) in b {
                merge_values(a.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (a, b) => {
            *a = b.clone();
        }
    }
}

pub fn merge_permissions(
    permissions: Vec<FilezPermission>,
) -> anyhow::Result<MergedFilezPermission> {
    if permissions.is_empty() {
        bail!("No permissions found");
    }
    let mut merged_permission = MergedFilezPermission {
        ribston: vec![],
        acl: None,
    };

    let mut merged_acl = Value::Null;

    for permission in permissions {
        if let Some(ribston) = permission.ribston {
            merged_permission.ribston.push(ribston);
        }
        if let Some(acl) = permission.acl {
            merge_values(&mut merged_acl, &serde_json::to_value(&acl)?);
        }
    }

    merged_permission.acl = serde_json::from_value(merged_acl)?;

    Ok(merged_permission)
}

pub fn get_folder_and_file_path(id: &str, storage_path: &str) -> (String, String) {
    let (folder, file_name) = id.split_at(3);
    let fd = folder
        .chars()
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join("/");
    (
        Path::new(storage_path)
            .join(fd)
            .to_string_lossy()
            .to_string(),
        file_name.to_string(),
    )
}

#[allow(clippy::manual_map)]
pub fn get_token_from_query(req: &Request<Body>) -> Option<String> {
    match req.uri().query() {
        Some(q) => match QString::from(q).get("t") {
            Some(qp) => Some(qp.to_string()),
            None => None,
        },
        None => None,
    }
}

pub async fn check_auth(
    auth: &Auth,
    file: &FilezFile,
    db: &DB,
    acl_type: &str,
) -> anyhow::Result<bool> {
    let mut auth_ok = false;

    if let Some(user_id) = &auth.authenticated_user {
        // user present
        if file.owner_id == *user_id {
            // user is the owner
            auth_ok = true;
        }
    }

    if !auth_ok {
        // user is not the owner
        // check if file is public
        let permissions = db.get_merged_permissions_from_file(file).await?;

        if let Some(permissions_acl) = permissions.acl {
            // check if public
            if let Some(everyone_acl_perm) = permissions_acl
                .everyone
                .and_then(|everyone| get_acl!(everyone, acl_type))
            {
                if everyone_acl_perm {
                    auth_ok = true;
                }
            }

            // check if password present and correct
            if !auth_ok {
                if let Some(token) = &auth.token {
                    // handle password

                    if let Some(passwords_acl_perm) = permissions_acl
                        .passwords
                        .and_then(|passwords| get_acl!(passwords, acl_type))
                    {
                        if passwords_acl_perm.contains(token) {
                            auth_ok = true;
                        }
                    }
                }
            }
            if !auth_ok {
                if let Some(user_id) = &auth.authenticated_user {
                    if let Some(users_acl_perm) = permissions_acl
                        .users
                        .and_then(|users| get_acl!(users, acl_type))
                    {
                        if let Some(users_acl_perm_user_ids) = users_acl_perm.user_ids {
                            if users_acl_perm_user_ids.contains(user_id) {
                                // user is in list of users that have access
                                auth_ok = true;
                            }
                        }
                        if !auth_ok {
                            if let Some(users_acl_perm_user_group_ids) =
                                users_acl_perm.user_group_ids
                            {
                                let user = db.get_user_by_id(user_id).await?;
                                if let Some(user_groups) = user.group_ids {
                                    for user_group in user_groups {
                                        if users_acl_perm_user_group_ids.contains(&user_group) {
                                            // user is in a user group that has access to the resource
                                            auth_ok = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if !auth_ok { // TODO handle ribston

                // if we dont have permission from the easy to check acl yet we need to check ribston

                // send all policies to ribston for evaluation
                // all need to be true for access to be granted
            }
        }
    }

    Ok(auth_ok)
}
