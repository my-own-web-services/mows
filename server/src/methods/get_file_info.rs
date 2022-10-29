use crate::db::DB;
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn get_file_info(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let file_id = req.uri().path().replacen("/get_file_info/", "", 1);

    let file = db.get_file_by_id(&file_id).await?;

    // check if user is allowed to access file
    if user_id != file.owner_id {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file");
    }

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&file)?.into())
        .unwrap())
}
