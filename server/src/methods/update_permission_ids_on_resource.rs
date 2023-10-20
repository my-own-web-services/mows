use crate::{db::DB, internal_types::Auth, types::UpdatePermissionsRequestBody};
use hyper::{Body, Request, Response};

// update permission ids on resource: either fileGroup or file
// a user can only update permissions on a resource if they are the owner of the resource and the permission
pub async fn update_permission_ids_on_resource(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = match &auth.authenticated_user {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => return Ok(res.status(412).body(Body::from("User has not been created on the filez server, although it is present on the IR server. Run create_own first."))?),
        },
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let upr: UpdatePermissionsRequestBody = serde_json::from_slice(&body)?;

    db.update_permission_ids_on_resource(&upr, &requesting_user.user_id)
        .await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
