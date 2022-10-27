use crate::db::DB;
use hyper::{Body, Request, Response};

pub async fn get_user_info(
    _req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let user = db.get_user_by_id(user_id).await?;

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&user)?.into())
        .unwrap())
}
