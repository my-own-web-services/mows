use crate::{config::SERVER_CONFIG, db::DB, some_or_bail, types::FilezFile};
use anyhow::bail;
use hyper::{Body, Request};
use qstring::QString;
use serde_json::Value;
use std::{collections::HashMap, num::ParseIntError, path::Path};

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
            CHARSET[idx] as char
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

pub fn get_query_item_number(req: &Request<Body>, item: &str) -> Option<i64> {
    match get_query_item(req, item) {
        Some(l) => match l.parse::<i64>() {
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

pub async fn create_users(db: &DB) -> anyhow::Result<()> {
    let config = &SERVER_CONFIG;

    let users_to_create = config.users.create.clone();

    for user in users_to_create {
        if db.get_user_by_email(&user).await?.is_none() {
            let res = db
                .create_user(
                    None,
                    Some(crate::types::UserStatus::Active),
                    None,
                    Some(user),
                )
                .await;
            if res.is_err() {
                println!("Error creating mock user: {:?}", res);
            }
        }
    }

    Ok(())
}
