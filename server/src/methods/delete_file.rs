use crate::{db::DB, internal_types::Auth, some_or_bail, utils::check_auth};
use anyhow::bail;
use hyper::{Body, Request, Response};
use std::fs;

pub async fn delete_file(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let file_id = req.uri().path().replacen("/api/delete_file/", "", 1);

    let file = some_or_bail!(db.get_file_by_id(&file_id).await?, "File not found");

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

    db.delete_file_by_id(&file).await?;
    fs::remove_file(&file.path)?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}
