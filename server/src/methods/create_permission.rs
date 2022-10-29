use crate::{
    db::DB,
    types::{CreatePermissionRequest, CreatePermissionResponse, FilezPermission},
    utils::generate_id,
};
use hyper::{Body, Request, Response};

// creates a permission for an authenticated user
pub async fn create_permission(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cpr: CreatePermissionRequest = serde_json::from_slice(&body)?;

    let permission_id = generate_id();

    let permission = FilezPermission {
        owner_id: user_id.to_string(),
        name: cpr.name,
        permission_id: permission_id.clone(),
        acl: cpr.acl,
        ribston: cpr.ribston,
    };

    db.create_permission(&permission).await?;

    let res_body = CreatePermissionResponse { permission_id };

    Ok(Response::builder()
        .status(201)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}
