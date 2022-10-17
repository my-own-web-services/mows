use anyhow::bail;
use arangors::Connection;
use hyper::{Body, Request, Response};

use crate::db::DB;

pub async fn get_file_info(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";
    if req.method() != hyper::Method::GET {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }
    let file_id = req.uri().path().replacen("/get_file_info/", "", 1);

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let file = db.get_file_by_id(&file_id).await?;

    // check if user is allowed to access file
    if user_id != file.owner {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file");
    }

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&file)?.into())
        .unwrap())
}
