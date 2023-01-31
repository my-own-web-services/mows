use crate::{db::DB, internal_types::Auth, types::UpdatePermissionsRequest};
use hyper::{Body, Request, Response};

// update permission ids on resource: either fileGroup or file
// a user can only update permissions on a resource if they are the owner of the resource and the permission
pub async fn update_permission_ids_on_resource(
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
    let upr: UpdatePermissionsRequest = serde_json::from_slice(&body)?;

    db.update_permission_ids_on_resource(&upr, user_id).await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
