use std::{
    fs::{self, File},
    io::Write,
};

use anyhow::bail;
use arangors::Connection;
use hyper::{body::HttpBody, Body, Request, Response};
use sha2::{Digest, Sha256};

use crate::{
    config::SERVER_CONFIG,
    db::DB,
    some_or_bail,
    types::{CreateFileRequest, CreateFileResponse, FilezFile},
    utils::{generate_id, get_folder_and_file_path},
};

pub async fn create_file(mut req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";
    let config = &SERVER_CONFIG;

    if req.method() != hyper::Method::POST {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }
    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let create_request: CreateFileRequest = serde_json::from_str(request_header)?;

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let user = db.get_user_by_id(user_id).await?;

    let storage_name = create_request
        .storage_name
        .unwrap_or_else(|| config.default_storage.clone());

    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = some_or_bail!(
        user.limits.get(&storage_name),
        format!("Invalid storage name: {}", storage_name)
    );
    let bytes_left = storage_limits.max_storage - storage_limits.used_storage;
    if size_hint.lower() > bytes_left
        || size_hint.upper().is_some() && size_hint.upper().unwrap() > bytes_left
    {
        bail!("User storage limit exceeded");
    }

    // file count check
    if storage_limits.used_files >= storage_limits.max_files {
        bail!("User file limit exceeded");
    }

    let storage_path = some_or_bail!(
        config.storage.get(&storage_name),
        format!("Invalid storage name: {}", storage_name)
    )
    .path
    .clone();

    let id = generate_id();
    let (folder_path, file_name) = get_folder_and_file_path(&id, &storage_path);

    dbg!(&folder_path);

    fs::create_dir_all(&folder_path)?;
    // write file to disk but abbort if limits where exceeded
    let file_path = format!("{}/{}", folder_path, file_name);
    let mut file = File::create(&file_path)?;
    let mut hasher = Sha256::new();

    let mut bytes_written = 0;
    while let Some(chunk) = req.body_mut().data().await {
        let chunk = chunk?;
        bytes_written += chunk.len() as u64;
        if bytes_written > bytes_left {
            fs::remove_file(&file_path)?;
            bail!("User storage limit exceeded");
        }
        hasher.write_all(&chunk)?;
        file.write_all(&chunk)?;
    }

    let hash = hex::encode(hasher.finalize());
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    // update db in this "create file transaction"
    let cft = db
        .create_file(FilezFile {
            id: id.clone(),
            mime_type: create_request.mime_type,
            name: create_request.name,
            owner: user.id,
            sha256: hash.clone(),
            storage_name: storage_name.clone(),
            size: bytes_written,
            created: current_time,
            modified: None,
            groups: create_request.groups,
            app_data: None,
            accessed: None,
            accessed_count: 0,
            time_of_death: None,
        })
        .await;

    if cft.is_err() {
        fs::remove_file(&file_path)?;
        bail!("Failed to create file in database");
    } else {
        let cfr = CreateFileResponse {
            id,
            storage_name,
            sha256: hash,
        };
        Ok(Response::builder()
            .status(200)
            .body(Body::from(serde_json::to_string(&cfr)?))?)
    }
}
