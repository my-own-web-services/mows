use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

pub async fn get_permissions_for_current_user(
    _req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let permissions = db.get_permissions_by_owner_id(user_id).await?;

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&permissions)?.into())
        .unwrap())
}
