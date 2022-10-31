use crate::{db::DB, internal_types::Auth, utils::check_auth};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn get_file_info(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let file_id = req.uri().path().replacen("/get_file_info/", "", 1);

    let file = db.get_file_by_id(&file_id).await?;

    match check_auth(auth, &file, &db, "get_file_info").await {
        Ok(true) => {}
        Ok(false) => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))
                .unwrap());
        }
        Err(e) => bail!(e),
    }

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&file)?.into())
        .unwrap())
}
