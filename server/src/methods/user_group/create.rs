use crate::{
    db::DB,
    internal_types::Auth,
    types::{CreateUserGroupRequestBody, CreateUserGroupResponseBody, UserGroup},
    utils::generate_id,
};
use hyper::{body::Body, Request, Response};

// creates a group for an authenticated user
pub async fn create_user_group(
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

    let cgr: CreateUserGroupRequestBody = serde_json::from_slice(&body)?;

    let group_id = generate_id(16);

    let user_group = UserGroup {
        owner_id: requesting_user.user_id.to_string(),
        name: cgr.name,
        user_group_id: group_id.clone(),
        visibility: cgr.visibility,
    };

    db.create_user_group(&user_group).await?;

    let res_body = CreateUserGroupResponseBody { group_id };

    Ok(res
        .status(201)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}
