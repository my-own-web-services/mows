use std::{
    fs::{self, File},
    io::Write,
};

use anyhow::bail;
use hyper::{body::HttpBody, Body, Request, Response};
use sha2::{Digest, Sha256};

use crate::{
    db::DB,
    internal_types::Auth,
    some_or_bail,
    types::{UpdateFileRequest, UpdateFileResponse},
    utils::check_auth,
};

pub async fn update_file(
    mut req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let update_request: UpdateFileRequest = serde_json::from_str(request_header)?;

    let filez_file = match db.get_file_by_id(&update_request.file_id).await {
        Ok(file) => file,
        Err(_) => bail!("File not found"),
    };

    let file_owner = match db.get_user_by_id(&filez_file.owner_id).await {
        Ok(user) => user,
        Err(_) => bail!("User not found"),
    };

    match check_auth(auth, &filez_file, &db, "update_file").await {
        Ok(true) => {}
        Ok(false) => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))
                .unwrap());
        }
        Err(e) => bail!(e),
    }

    let storage_id = some_or_bail!(filez_file.storage_id.clone(), "No storage id found");

    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = some_or_bail!(
        file_owner.limits.get(&storage_id),
        format!(
            "Storage name: '{}' is missing specifications on the user entry",
            storage_id
        )
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

    // write file to disk but abbort if limits where exceeded
    let new_file_path = format!("{}_update", &filez_file.path);
    dbg!(&new_file_path);
    let mut file = File::create(&new_file_path)?;
    let mut hasher = Sha256::new();

    let mut bytes_written = 0;
    while let Some(chunk) = req.body_mut().data().await {
        let chunk = chunk?;
        bytes_written += chunk.len() as u64;
        if bytes_written > bytes_left {
            fs::remove_file(&new_file_path)?;
            bail!("User storage limit exceeded");
        }
        hasher.write_all(&chunk)?;
        file.write_all(&chunk)?;
    }

    let hash = hex::encode(hasher.finalize());
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    // update db
    let cft = db
        .update_file_with_content_change(
            &filez_file,
            &hash,
            bytes_written,
            update_request.modified.unwrap_or(current_time),
        )
        .await;

    if cft.is_err() {
        fs::remove_file(&new_file_path)?;
        bail!("Failed to create file in database: {}", cft.err().unwrap());
    } else {
        fs::rename(&new_file_path, &filez_file.path)?;
        let cfr = UpdateFileResponse { sha256: hash };
        Ok(Response::builder()
            .status(200)
            .body(Body::from(serde_json::to_string(&cfr)?))?)
    }
}
