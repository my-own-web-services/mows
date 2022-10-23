use std::fs::{DirEntry, Metadata};

use crate::some_or_bail;

pub fn generate_id() -> String {
    use rand::Rng;
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const PASSWORD_LEN: usize = 32;
    let mut rng = rand::thread_rng();

    (0..PASSWORD_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

pub fn get_modified_time_secs(metadata: &Metadata) -> Option<i64> {
    // TODO: this will fail for files older than 1970
    match metadata.modified() {
        Ok(sytem_time) => match sytem_time.duration_since(std::time::UNIX_EPOCH) {
            Ok(duration) => Some(duration.as_secs() as i64),
            Err(_) => None,
        },
        Err(_) => None,
    }
}

pub fn get_created_time_secs(metadata: &Metadata) -> Option<i64> {
    // TODO: this will fail for files older than 1970

    match metadata.modified() {
        Ok(sytem_time) => match sytem_time.duration_since(std::time::UNIX_EPOCH) {
            Ok(duration) => Some(duration.as_secs() as i64),
            Err(_) => None,
        },
        Err(_) => None,
    }
}

pub fn recursive_read_dir(path: &str) -> anyhow::Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            entries.extend(recursive_read_dir(some_or_bail!(
                path.to_str(),
                "Could not convert path to sr"
            ))?);
        } else {
            entries.push(entry);
        }
    }
    Ok(entries)
}
