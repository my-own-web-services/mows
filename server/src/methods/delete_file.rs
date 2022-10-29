use std::fs;

use anyhow::bail;
use hyper::{Body, Request, Response};

use crate::{config::SERVER_CONFIG, db::DB, utils::get_folder_and_file_path};

pub async fn delete_file(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let file_id = req.uri().path().replacen("/delete_file/", "", 1);

    let file = db.get_file_by_id(&file_id).await?;

    if user_id != file.owner_id {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file");
    }

    let (folder_path, file_name) =
        get_folder_and_file_path(&file.file_id, &config.storage[&file.storage_name].path);

    let file_path = format!("{}/{}", folder_path, file_name);

    db.delete_file_by_id(&file).await?;
    fs::remove_file(file_path)?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}
