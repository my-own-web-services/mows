use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    some_or_bail,
    utils::{check_auth, get_folder_and_file_path, get_query_item, get_range},
};
use anyhow::bail;
use hyper::{Body, Request, Response};
use hyper_staticfile::util::FileBytesStreamRange;
use std::path::Path;

pub async fn get_file(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    mut res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let path = req.uri().path().replacen("/api/get_file/", "", 1);

    let parts = path.split('/').collect::<Vec<_>>();
    let file_id = if !parts.is_empty() {
        parts[0].to_string()
    } else {
        bail!("No file id")
    };
    let app_file = {
        if parts.len() < 2 {
            None
        } else {
            let maybe_app = parts[1].to_string();
            let maybe_app_file = parts[2..].join("/");

            if !maybe_app.is_empty() && !maybe_app_file.is_empty() {
                Some((maybe_app, maybe_app_file))
            } else {
                None
            }
        }
    };
    if app_file.is_none() && parts.len() > 1 {
        bail!("Invalid path");
    }

    let file = match db.get_file_by_id(&file_id).await {
        Ok(f) => some_or_bail!(f, "File not found"),
        Err(_) => {
            return Ok(res.status(404).body(Body::from("File not found")).unwrap());
        }
    };

    match check_auth(auth, &file, &db, "get_file").await {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    }

    if get_query_item(&req, "c").is_some() {
        res = res.header("Cache-Control", "public, max-age=31536000");
    };

    match app_file {
        Some(af) => {
            let (folder_path, file_name) = get_folder_and_file_path(&file_id, &af.0);

            let p = Path::new(&config.app_storage.path)
                .join(folder_path)
                .join(&file_name)
                .join(&af.1);
            let file_handle = tokio::fs::File::open(&p).await?;

            let body = match get_range(&req) {
                Ok(r) => Body::wrap_stream(FileBytesStreamRange::new(file_handle, r)),
                Err(_) => Body::wrap_stream(hyper_staticfile::FileBytesStream::new(file_handle)),
            };

            let mime_type = mime_guess::from_path(&af.1)
                .first_or_octet_stream()
                .to_string();

            Ok(res
                .status(200)
                .header("Content-Type", mime_type)
                .body(body)
                .unwrap())
        }
        None => {
            // stream the file from disk to the client
            let file_handle = tokio::fs::File::open(&file.path).await?;

            let body = match get_range(&req) {
                Ok(r) => Body::wrap_stream(FileBytesStreamRange::new(file_handle, r)),
                Err(_) => Body::wrap_stream(hyper_staticfile::FileBytesStream::new(file_handle)),
            };

            let illegal_types = vec!["text/html", "application/javascript", "text/css"];

            Ok(res
                .status(200)
                .header(
                    "Content-Type",
                    if illegal_types.contains(&file.mime_type.as_str()) {
                        "text/plain".to_string()
                    } else {
                        file.mime_type
                    },
                )
                .body(body)
                .unwrap())
        }
    }
}
