use crate::{
    db::DB,
    internal_types::Auth,
    types::{CreatePermissionRequestBody, CreatePermissionResponseBody, FilezPermission},
    utils::generate_id,
};
use hyper::{Body, Request, Response};

// creates a permission for an authenticated user
pub async fn create_permission(
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
    let cpr: CreatePermissionRequestBody = serde_json::from_slice(&body)?;

    let permission_id = generate_id(16);

    let permission = FilezPermission {
        owner_id: user_id.to_string(),
        name: cpr.name,
        permission_id: permission_id.clone(),
        acl: cpr.acl,
        use_type: cpr.use_type,
        ribston: cpr.ribston,
    };

    db.create_permission(&permission).await?;

    let res_body = CreatePermissionResponseBody { permission_id };

    Ok(res
        .status(201)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}
