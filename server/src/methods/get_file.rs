use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    some_or_bail,
    utils::{check_auth, get_folder_and_file_path, get_query_item, get_range},
};
use anyhow::bail;
use http_range::HttpRange;
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

    let full_file_path = match &app_file {
        Some(af) => {
            let (folder_path, file_name) = get_folder_and_file_path(&file_id, &af.0);

            Path::new(&config.app_storage.path)
                .join(folder_path)
                .join(&file_name)
                .join(&af.1)
        }
        None => Path::new(&file.path).to_path_buf(),
    };

    let file_handle = tokio::fs::File::open(&full_file_path).await?;
    let file_size = file_handle.metadata().await?.len();

    let body = match get_range(&req) {
        Ok((start_byte, maybe_end_byte)) => {
            res = res.header("Connection", "Keep-Alive");
            res = res.header("Keep-Alive", "timeout=5, max=100");
            res = res.status(206);
            res = res.header("Accept-Ranges", "bytes");

            match maybe_end_byte {
                Ok(end_byte) => {
                    // end requested

                    let length = end_byte - start_byte + 1;

                    res = res.header(
                        "Content-Range",
                        format!("bytes {}-{}/{}", start_byte, end_byte, file_size),
                    );
                    res = res.header("Content-Length", length);

                    Body::wrap_stream(FileBytesStreamRange::new(
                        file_handle,
                        HttpRange {
                            start: start_byte,
                            length,
                        },
                    ))
                }
                Err(_) => {
                    // no end requested so we just return the rest of the file
                    res = res.header(
                        "Content-Range",
                        format!("bytes {}-{}/{}", start_byte, file_size - 1, file_size),
                    );

                    // TODO is this off by one?

                    res = res.header("Content-Length", file_size - start_byte);

                    Body::wrap_stream(FileBytesStreamRange::new(
                        file_handle,
                        HttpRange {
                            start: start_byte,
                            length: file_size - start_byte,
                        },
                    ))
                }
            }
        }
        Err(_) => {
            res = res.header("Content-Length", file_size);
            Body::wrap_stream(hyper_staticfile::FileBytesStream::new(file_handle))
        }
    };

    let mime_type = match &app_file {
        Some(af) => mime_guess::from_path(&af.1)
            .first_or_octet_stream()
            .to_string(),
        None => file.mime_type,
    };

    let illegal_types = vec!["text/html", "application/javascript", "text/css"];

    let res = res.header(
        "Content-Type",
        if illegal_types.contains(&mime_type.as_str()) {
            "text/plain".to_string()
        } else {
            mime_type
        },
    );

    Ok(res.body(body).unwrap())
}
