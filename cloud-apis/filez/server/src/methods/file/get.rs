use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::check_auth_multiple,
    some_or_bail,
    utils::{get_query_item, get_range},
};
use anyhow::bail;
use filez_common::{
    server::permission::{CommonAclWhatOptions, FilezFilePermissionAclWhatOptions},
    storage::index::{get_app_data_folder_for_file, get_storage_location_from_file},
};
use http_range::HttpRange;
use hyper::{Body, Request, Response};
use hyper_staticfile::util::FileBytesStreamRange;
use std::path::Path;

/**
# Gets a files contents by id in raw form as well as derivatives of the file created by converters or other apps.

## Call
Raw File:
`/api/file/get/{file_id}`
Derivatives:
`/api/file/get/{file_id}/{app_name}/{app_file_path}`
The app_file_path is set by the app and should be defined in the specific app's documentation.

## Permissions
File > GetFile
File > GetFileDerivatives // TODO: implement

## Multiple Resources
No

*/
pub async fn get_file(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    mut res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let path = req.uri().path().replacen("/api/file/get/", "", 1);

    let parts = path.split('/').collect::<Vec<_>>();
    let file_id = some_or_bail!(parts.first(), "No file id").to_string();

    let app_file = {
        if parts.len() < 2 {
            None
        } else {
            let maybe_app_id = some_or_bail!(parts.get(1), "Invalid App ID").to_string();
            let maybe_app_file_path =
                some_or_bail!(parts.get(2..), "Invalid App file path").join("/");

            if !maybe_app_id.is_empty() && !maybe_app_file_path.is_empty() {
                Some((maybe_app_id, maybe_app_file_path))
            } else {
                None
            }
        }
    };

    if app_file.is_none() && parts.len() > 1 {
        return Ok(res.status(400).body(Body::from("Invalid Path")).unwrap());
    }

    let file = match db.get_file_by_id(&file_id).await {
        Ok(f) => some_or_bail!(f, "File not found"),
        Err(_) => {
            return Ok(res.status(404).body(Body::from("File not found")).unwrap());
        }
    };

    match check_auth_multiple(
        auth,
        &into_permissive_resource!(vec![file.clone()]),
        &CommonAclWhatOptions::File(FilezFilePermissionAclWhatOptions::FileGet),
        db,
    )
    .await
    {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    }

    if get_query_item(&req, "c").is_some() {
        res = res.header("Cache-Control", "public, max-age=31536000");
    };

    if get_query_item(&req, "d").is_some() {
        res = res.header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", file.name),
        );
    }

    let full_file_path = match &app_file {
        Some((app_id, app_file_path)) => {
            let app_storage_folder = get_app_data_folder_for_file(&config.storage, &file, app_id)?;

            Path::new(&app_storage_folder.file_folder).join(app_file_path)
        }
        None => {
            let sl = get_storage_location_from_file(&config.storage, &file)?;
            Path::new(&sl.full_path).to_path_buf()
        }
    };

    let file_handle = tokio::fs::File::open(&full_file_path).await?;
    let file_size = file_handle.metadata().await?.len();

    let body = match get_range(&req) {
        Ok((start_byte, maybe_end_byte)) => {
            res = res
                .header("Connection", "Keep-Alive")
                .header("Keep-Alive", "timeout=5, max=100")
                .status(206)
                .header("Accept-Ranges", "bytes");

            if start_byte >= file_size {
                bail!("Start byte is after file size");
            }

            match maybe_end_byte {
                Ok(end_byte) => {
                    // end requested
                    if end_byte < start_byte {
                        bail!("End byte is before start byte");
                    }
                    if end_byte >= file_size {
                        bail!("End byte is after file size");
                    }

                    let length =
                        some_or_bail!(end_byte.checked_sub(start_byte), "Invalid range") + 1;

                    res = res
                        .header(
                            "Content-Range",
                            format!("bytes {}-{}/{}", start_byte, end_byte, file_size),
                        )
                        .header("Content-Length", length);

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
                    res = res
                        .header(
                            "Content-Range",
                            format!("bytes {}-{}/{}", start_byte, file_size - 1, file_size),
                        )
                        .header("Content-Length", file_size - start_byte);

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

    let illegal_types = ["text/html", "application/javascript", "text/css"];

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
