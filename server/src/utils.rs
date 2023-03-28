use crate::{
    config::{ServerConfig, SERVER_CONFIG},
    db::DB,
    get_acl, get_acl_users,
    internal_types::{Auth, MergedFilezPermission},
    some_or_bail,
    types::{FilezFile, FilezPermission},
};
use anyhow::bail;
use hyper::{body::Bytes, Body, Request};
use qstring::QString;
use serde_json::Value;
use std::{collections::HashMap, num::ParseIntError, path::Path, vec};

pub fn get_cookies(req: &Request<Body>) -> anyhow::Result<HashMap<String, String>> {
    let cookie_str = some_or_bail!(req.headers().get("cookie"), "No cookies found").to_str()?;
    let split = cookie_str.split(';');

    let mut cookies = HashMap::new();

    for s in split {
        let parsed_cookie = cookie::Cookie::parse(s);
        if let Ok(p) = parsed_cookie {
            cookies.insert(p.name().to_string(), p.value().to_string());
        }
    }

    Ok(cookies)
}

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

pub fn get_range(req: &Request<Body>) -> anyhow::Result<(u64, Result<u64, ParseIntError>)> {
    let range = req
        .headers()
        .get("Range")
        .map(|h| h.to_str().unwrap_or("").to_string());

    match range {
        Some(r) => {
            let parts = r.split('=').collect::<Vec<_>>();
            if parts.len() != 2 {
                bail!("Invalid range");
            }
            let range_type = parts[0];
            let range = parts[1];
            if range_type != "bytes" {
                bail!("Invalid range type");
            }
            let range_parts = range.split('-').collect::<Vec<_>>();

            if range_parts.len() != 2 {
                bail!("Invalid range");
            }
            let start = range_parts[0].parse::<u64>()?;
            let end = range_parts[1].parse::<u64>();
            Ok((start, end))
        }
        None => bail!("No range"),
    }
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

pub fn get_token_from_query(req: &Request<Body>) -> Option<String> {
    get_query_item(req, "t")
}

#[allow(clippy::manual_map)]
pub fn get_query_item(req: &Request<Body>, item: &str) -> Option<String> {
    match req.uri().query() {
        Some(q) => match QString::from(q).get(item) {
            Some(qp) => Some(qp.to_string()),
            None => None,
        },
        None => None,
    }
}

pub fn get_query_item_number(req: &Request<Body>, item: &str) -> Option<i64> {
    match get_query_item(req, item) {
        Some(l) => match l.parse::<i64>() {
            Ok(l) => Some(l),
            Err(_) => None,
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
    let config = &SERVER_CONFIG;
    let mut auth_ok = false;

    if let Some(user_id) = &auth.authenticated_user {
        // user present
        if file.owner_id == *user_id {
            // user is the owner
            auth_ok = true;
        }
    }

    if !auth_ok {
        if config.dev.disable_complex_access_control {
            bail!("Complex access control has been disabled");
        };

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
                        .and_then(|users| get_acl_users!(users, acl_type))
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
                                if let Some(user) = db.get_user_by_id(user_id).await? {
                                    for user_group in user.user_group_ids {
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

pub fn check_file_name(file_name: &str) -> anyhow::Result<()> {
    let max_length = 100;
    let name_len = file_name.len();
    if name_len > max_length {
        bail!("File name too long: {name_len}/{max_length}");
    }
    Ok(())
}

pub fn check_mime_type(mime_type: &str) -> anyhow::Result<()> {
    let max_length = 100;
    let mime_type_len = mime_type.len();
    if mime_type_len > max_length {
        bail!("Mime type too long: {mime_type_len}/{max_length}");
    }
    if !mime_type.contains('/') {
        bail!("Mime type is missing '/' ");
    }

    Ok(())
}

pub fn check_keywords(keywords: &Vec<String>) -> anyhow::Result<()> {
    if keywords.len() > 100 {
        bail!("Too many keywords");
    }
    let max_length = 100;
    for keyword in keywords {
        let keyword_len = keyword.len();
        if keyword_len > max_length {
            bail!("Keyword too long: {keyword_len}/{max_length}");
        }
    }
    Ok(())
}

pub fn check_storage_id(storage_id: &str) -> anyhow::Result<()> {
    let max_length = 100;
    let storage_id_len = storage_id.len();
    if storage_id_len > max_length {
        bail!("Storage id too long: {storage_id_len}/{max_length}");
    }
    Ok(())
}

pub fn check_static_file_groups(static_file_groups: &Vec<String>) -> anyhow::Result<()> {
    if static_file_groups.len() > 100 {
        bail!("Too many static file groups");
    }
    let max_length = 100;
    for static_file_group in static_file_groups {
        let static_file_group_len = static_file_group.len();
        if static_file_group_len > max_length {
            bail!("Static file group too long: {static_file_group_len}/{max_length}");
        }
    }
    Ok(())
}

pub fn check_owner_id(owner_id: &str) -> anyhow::Result<()> {
    let max_length = 32;
    let owner_id_len = owner_id.len();
    if owner_id_len > max_length {
        bail!("Owner id too long: {owner_id_len}/{max_length}");
    }
    Ok(())
}
