use crate::{config::SERVER_CONFIG, db::DB, some_or_bail};
use anyhow::bail;
use filez_common::server::{FilezFile, UsageLimits};
use hyper::{Body, Request};
use itertools::Itertools;
use qstring::QString;
use serde_json::Value;
use std::{collections::HashMap, num::ParseIntError};

pub async fn update_default_user_limits(db: &DB) -> anyhow::Result<()> {
    let storage_config = &SERVER_CONFIG.storage;
    let users = db.get_all_users().await?;

    // HELP WANTED: optimize this to scale to a larger number of users

    for user in &users {
        let mut limits = user.limits.clone();
        for (storage_name, storage) in &storage_config.storages {
            if storage.readonly.is_none() {
                if let Some(storage_default_user_limits) = &storage.default_user_limits {
                    if !limits.contains_key(storage_name) {
                        limits.insert(
                            storage_name.to_string(),
                            Some(UsageLimits {
                                max_storage: storage_default_user_limits.max_storage,
                                max_files: storage_default_user_limits.max_files,
                                max_bandwidth: storage_default_user_limits.max_bandwidth,
                                used_bandwidth: 0,
                                used_files: 0,
                                used_storage: 0,
                            }),
                        );
                    }
                }
            }
        }

        db.update_user_limits(&user.user_id, &limits).await?;
    }

    Ok(())
}

pub fn is_allowed_origin(origin_to_test: &str) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    if !config
        .services
        .iter()
        .any(|s| s.allowed_origins.iter().any(|ss| ss == origin_to_test))
    {
        bail!(
            "Assertion host mismatch: {} is not in list of allowed origins ",
            origin_to_test
        );
    }
    Ok(())
}

pub fn is_allowed_service_id(service_id_to_test: &str) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;
    if !config.services.iter().any(|s| s.id == service_id_to_test) {
        bail!(
            "Assertion service ID mismatch: {} is not in list of allowed service ids",
            service_id_to_test
        );
    }
    Ok(())
}

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

pub fn generate_id(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            *CHARSET.get(idx).unwrap() as char
        })
        .collect()
}

pub fn merge_values(a: &mut Value, b: &Value) {
    match (a, b) {
        (&mut Value::Object(ref mut a), Value::Object(ref b)) => {
            for (k, v) in b {
                merge_values(a.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (a, b) => {
            *a = b.clone();
        }
    }
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
            let range_type = some_or_bail!(parts.first(), "No range type");
            let range = some_or_bail!(parts.get(1), "No range");
            if range_type != &"bytes" {
                bail!("Invalid range type");
            }
            let range_parts = range.split('-').collect::<Vec<_>>();

            if range_parts.len() != 2 {
                bail!("Invalid range");
            }
            let start =
                some_or_bail!(range_parts.first(), "Invalid range byte start").parse::<u64>()?;
            let end = some_or_bail!(range_parts.get(1), "Invalid range byte end").parse::<u64>();
            Ok((start, end))
        }
        None => bail!("No range"),
    }
}

pub fn get_password_from_query(req: &Request<Body>) -> Option<String> {
    get_query_item(req, "pw")
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

// any number that implemenets from string
pub fn get_query_item_number<Number>(req: &Request<Body>, item: &str) -> Option<Number>
where
    Number: std::str::FromStr,
    <Number as std::str::FromStr>::Err: std::fmt::Debug,
{
    match get_query_item(req, item) {
        Some(l) => match l.parse::<Number>() {
            Ok(l) => Some(l),
            Err(_) => None,
        },
        None => None,
    }
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
    let max_length = 20;
    for static_file_group in static_file_groups {
        let static_file_group_len = static_file_group.len();
        if static_file_group_len > max_length {
            bail!("Static file group ID too long: {static_file_group_len}/{max_length}");
        }
    }

    //check for duplicates
    let mut static_file_groups_clone = static_file_groups.clone();
    static_file_groups_clone.sort();
    static_file_groups_clone.dedup();
    if static_file_groups_clone.len() != static_file_groups.len() {
        bail!("Duplicate static file group IDs");
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

pub fn check_search_limit(limit: u32) -> anyhow::Result<()> {
    let max_limit = 10000;
    if limit > max_limit {
        bail!("Limit too high: {limit}/{max_limit}");
    }
    Ok(())
}

pub fn check_search_query(query: &str) -> anyhow::Result<()> {
    let max_length = 100;
    let query_len = query.len();
    if query_len > max_length {
        bail!("Query too long: {query_len}/{max_length}");
    }
    Ok(())
}

pub fn filter_files_by_owner_id(files: &Vec<FilezFile>, owner_id: &str) -> Vec<FilezFile> {
    let mut filtered_files = Vec::new();
    for file in files {
        if file.owner_id == owner_id {
            filtered_files.push(file.clone());
        }
    }
    filtered_files
}

pub fn fix_hierarchic_keywords(new_keywords: Vec<String>) -> Vec<String> {
    new_keywords
        .iter()
        .map(|k| {
            if k.contains('>') {
                // trim whitespace in front and after the > character
                k.split('>')
                    .map(|s| s.trim())
                    .collect::<Vec<&str>>()
                    .join(">")
            } else {
                k.trim().to_string()
            }
        })
        .filter(|k| !k.is_empty())
        .unique()
        .collect::<Vec<String>>()
}
