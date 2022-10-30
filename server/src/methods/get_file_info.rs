use crate::{db::DB, internal_types::Auth};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn get_file_info(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id.clone(),
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };

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
