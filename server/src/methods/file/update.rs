use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    into_permissive_resource, is_transient_transaction_error,
    permissions::{check_auth_multiple, CommonAclWhatOptions, FilezFilePermissionAclWhatOptions},
    some_or_bail,
};
use anyhow::bail;
use filez_common::storage::index::get_storage_location_from_file;
use hyper::{body::HttpBody, Body, Request, Response};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::Write,
};
use ts_rs::TS;

/**
# Updates the contents of a file.

## Call
`/api/file/update/`
## Permissions
File > UpdateFile


## Possible Mutations
Mutation > FilezFile
Mutation > FilezUser

## Multiple Resources
No

*/
pub async fn update_file(
    mut req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let update_request: UpdateFileRequest = serde_json::from_str(request_header)?;

    let filez_file = match db.get_file_by_id(&update_request.file_id).await {
        Ok(file) => some_or_bail!(file, "File not found"),
        Err(_) => bail!("File not found"),
    };

    if filez_file.readonly {
        bail!("File is readonly");
    }

    let file_owner = match db.get_user_by_id(&filez_file.owner_id).await {
        Ok(user) => some_or_bail!(user, "User/Owner not found"),
        Err(_) => bail!("User not found"),
    };
    match check_auth_multiple(
        auth,
        &into_permissive_resource!(&vec![filez_file.clone()]),
        &CommonAclWhatOptions::File(FilezFilePermissionAclWhatOptions::UpdateFile),
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

    let storage_id = some_or_bail!(filez_file.storage_id.clone(), "No storage id found");

    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = match &file_owner.limits.get(&storage_id) {
        Some(Some(ul)) => ul,
        _ => bail!(
            "Storage name: '{}' is missing specifications on the user entry",
            storage_id
        ),
    };
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

    let file_path = get_storage_location_from_file(&config.storage, &filez_file)?;

    let new_file_path = format!("{}_update", &file_path.full_path.display());
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
    while let Err(e) = db
        .update_file_with_content_change(
            &filez_file,
            &hash,
            bytes_written,
            update_request
                .modified
                .map(|o| o * 1000)
                .unwrap_or(current_time),
        )
        .await
    {
        if is_transient_transaction_error!(e) {
            continue;
        } else {
            fs::remove_file(&new_file_path)?;
            bail!("Failed to create file in database: {:?}", e);
        }
    }

    fs::rename(&new_file_path, &file_path.full_path)?;
    let cfr = UpdateFileResponse { sha256: hash };
    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&cfr)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileRequest {
    pub file_id: String,
    pub modified: Option<i64>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileResponse {
    pub sha256: String,
}
