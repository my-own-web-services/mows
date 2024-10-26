use std::fs::DirEntry;

pub const BASE_PATH: &str = "/public";

pub const COMPRESSABLE_MIME_TYPES: [&str; 15] = [
    "text/css",
    "application/javascript",
    "text/html",
    "image/svg+xml",
    "text/xml",
    "text/plain",
    "application/json",
    "application/yaml",
    "application/yml",
    "application/toml",
    "text/markdown",
    "application/wasm",
    "application/json-p",
    "text/javascript",
    "text/css",
];

pub fn recursive_read_dir(path: &str) -> Vec<DirEntry> {
    recursive_read_dir_inner(path).unwrap()
}

pub fn recursive_read_dir_inner(path: &str) -> Result<Vec<DirEntry>, Box<dyn std::error::Error>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path).unwrap() {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            entries.extend(recursive_read_dir_inner(path.to_str().unwrap()).unwrap());
        } else {
            entries.push(entry);
        }
    }
    Ok(entries)
}
