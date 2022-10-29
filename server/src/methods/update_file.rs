use std::{
    fs::{self, File},
    io::Write,
    path::Path,
};

use anyhow::bail;
use hyper::{body::HttpBody, Body, Request, Response};
use sha2::{Digest, Sha256};

use crate::{
    config::SERVER_CONFIG,
    db::DB,
    some_or_bail,
    types::{UpdateFileRequest, UpdateFileResponse},
    utils::get_folder_and_file_path,
};

pub async fn update_file(
    mut req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let update_request: UpdateFileRequest = serde_json::from_str(request_header)?;

    let user = db.get_user_by_id(user_id).await?;
    let filez_file = match db.get_file_by_id(&update_request.file_id).await {
        Ok(file) => file,
        Err(_) => bail!("File not found"),
    };

    let storage_name = filez_file.storage_name.clone();

    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = some_or_bail!(
        user.limits.get(&storage_name),
        format!(
            "Storage name: '{}' is missing specifications on the user entry",
            storage_name
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

    let storage_path = some_or_bail!(
        config.storage.get(&storage_name),
        format!("Invalid storage name: {}", storage_name)
    )
    .path
    .clone();

    let id = format!("{}_update", filez_file.file_id);
    let (folder_path, file_name) = get_folder_and_file_path(&id, &storage_path);

    dbg!(&folder_path);

    fs::create_dir_all(&folder_path)?;
    // write file to disk but abbort if limits where exceeded
    let new_file_path = Path::new(&folder_path).join(file_name);
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
        let (old_folder_path, old_file_name) =
            get_folder_and_file_path(&filez_file.file_id, &storage_path);
        let old_file_path = Path::new(&old_folder_path).join(old_file_name);

        fs::rename(&new_file_path, &old_file_path)?;
        let cfr = UpdateFileResponse { sha256: hash };
        Ok(Response::builder()
            .status(200)
            .body(Body::from(serde_json::to_string(&cfr)?))?)
    }
}
