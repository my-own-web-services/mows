use crate::{db::DB, internal_types::Auth, some_or_bail, utils::check_auth};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn get_file_info(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let file_id = req.uri().path().replacen("/api/file/info/get/", "", 1);

    let file = some_or_bail!(db.get_file_by_id(&file_id).await?, "File not found");

    match check_auth(auth, &file, &db, "get_file_info").await {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    }

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&file)?.into())
        .unwrap())
}
