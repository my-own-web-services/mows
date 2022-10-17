use std::fs::DirEntry;

use crate::some_or_bail;

pub fn get_modified_time_secs(dir_entry: &DirEntry) -> Option<u64> {
    match dir_entry.metadata() {
        Ok(metadata) => match metadata.modified() {
            Ok(sytem_time) => match sytem_time.duration_since(std::time::UNIX_EPOCH) {
                Ok(duration) => Some(duration.as_secs()),
                Err(_) => None,
            },
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
