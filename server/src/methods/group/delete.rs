use crate::{db::DB, internal_types::Auth, types::DeleteGroupRequestBody};
use hyper::{Body, Request, Response};

pub async fn delete_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let dgr: DeleteGroupRequestBody = serde_json::from_slice(&body)?;

    db.delete_group(&dgr, user_id).await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
