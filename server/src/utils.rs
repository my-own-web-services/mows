use anyhow::bail;
use hyper::{Body, Request};
use qstring::QString;
use serde_json::Value;
use std::{path::Path, vec};

use crate::{internal_types::MergedFilezPermission, types::FilezPermission};

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
