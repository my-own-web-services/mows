use crate::{db::DB, types::UpdatePermissionsRequest};
use hyper::{Body, Request, Response};

// update permission ids on resource: either fileGroup or file
// a user can only update permissions on a resource if they are the owner of the resource and the permission
pub async fn update_permission_ids_on_resource(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let upr: UpdatePermissionsRequest = serde_json::from_slice(&body)?;

    db.update_permission_ids_on_resource(&upr, user_id).await?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}
