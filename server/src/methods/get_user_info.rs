use arangors::Connection;
use hyper::{Body, Request, Response};

use crate::db::DB;

pub async fn get_user_info(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";
    if req.method() != hyper::Method::GET {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let user = db.get_user_by_id(user_id).await?;

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&user)?.into())
        .unwrap())
}
