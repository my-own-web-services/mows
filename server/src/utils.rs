use std::path::Path;

use hyper::{Body, Request};
use qstring::QString;

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
    match req.uri().query() {
        Some(q) => match QString::from(q).get("p") {
            Some(qp) => Some(qp.to_string()),
            None => None,
        },
        None => None,
    }
}
