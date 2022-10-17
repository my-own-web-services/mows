use arangors::Connection;
use hyper::{Body, Request, Response};

use crate::db::DB;
pub async fn get_files_by_group_id(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";

    if req.method() != hyper::Method::GET {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }
    let group_id = req.uri().path().replacen("/get_files_by_group_id/", "", 1);

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let files = db.get_files_by_group_id(&group_id).await?;

    let files = files
        .iter()
        .filter(|f| f.owner == user_id)
        .collect::<Vec<_>>();

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&files)?.into())
        .unwrap())
}
