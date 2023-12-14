use crate::{db::DB, internal_types::Auth, utils::get_query_item};
use hyper::{Body, Request, Response};

/**
# Deletes a permission.

## Call
`/api/permission/delete/?id={permission_id}`
## Permissions
None

*/
pub async fn delete_permission(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let permission_id = match get_query_item(&req, "id") {
        Some(v) => v,
        None => return Ok(res.status(400).body(Body::from("Missing id"))?),
    };

    let permission = match db.get_permission_by_id(&permission_id).await? {
        Some(p) => p,
        None => return Ok(res.status(404).body(Body::from("Permission not found"))?),
    };

    if permission.owner_id != requesting_user.user_id {
        return Ok(res.status(401).body(Body::from("Unauthorized"))?);
    }

    db.delete_permission(&permission_id).await?;

    Ok(res.status(200).body(Body::from("Ok"))?)
}
