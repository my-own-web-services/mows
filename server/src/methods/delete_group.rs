use crate::{db::DB, internal_types::Auth, types::DeleteGroupRequest};
use hyper::{Body, Request, Response};

pub async fn delete_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let dgr: DeleteGroupRequest = serde_json::from_slice(&body)?;

    db.delete_group(&dgr, user_id).await?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}
