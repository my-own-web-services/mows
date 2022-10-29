use crate::db::DB;
use hyper::{Body, Request, Response};

pub async fn get_permissions_for_current_user(
    _req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let permissions = db.get_permissions_by_owner_id(user_id).await?;

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&permissions)?.into())
        .unwrap())
}
