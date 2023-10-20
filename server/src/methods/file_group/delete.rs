use crate::{db::DB, internal_types::Auth};
use hyper::{body::Body, Request, Response};

// creates a group for an authenticated user
pub async fn delete_file_group(
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

    let file_group_id = req.uri().path().replacen("/api/file_group/delete/", "", 1);

    let file_group = match db.get_file_group_by_id(&file_group_id).await? {
        Some(fg) => fg,
        None => return Ok(res.status(404).body(Body::from("File group not found"))?),
    };

    if file_group.owner_id != requesting_user.user_id {
        return Ok(res.status(401).body(Body::from("Unauthorized"))?);
    }

    db.delete_file_group(&file_group).await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
