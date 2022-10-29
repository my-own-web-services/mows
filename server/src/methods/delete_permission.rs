use crate::{db::DB, types::DeletePermissionRequest};
use hyper::{Body, Request, Response};

pub async fn delete_permission(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let dgr: DeletePermissionRequest = serde_json::from_slice(&body)?;

    db.delete_permission(&dgr, user_id).await?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}
