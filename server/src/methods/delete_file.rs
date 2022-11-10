use std::fs;

use anyhow::bail;
use hyper::{Body, Request, Response};

use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    utils::{check_auth, get_folder_and_file_path},
};

pub async fn delete_file(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let file_id = req.uri().path().replacen("/api/delete_file/", "", 1);

    let file = db.get_file_by_id(&file_id).await?;

    match check_auth(auth, &file, &db, "delete_file").await {
        Ok(true) => {}
        Ok(false) => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))
                .unwrap());
        }
        Err(e) => bail!(e),
    }

    let (folder_path, file_name) =
        get_folder_and_file_path(&file.file_id, &config.storage[&file.storage_name].path);

    let file_path = format!("{}/{}", folder_path, file_name);

    db.delete_file_by_id(&file).await?;
    fs::remove_file(file_path)?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}
