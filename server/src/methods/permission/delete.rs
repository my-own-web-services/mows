use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

/**
# Deletes a permission.

## Call
`/api/permission/delete/`
## Permissions
None

*/
pub async fn delete_permission(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let permission_id = req.uri().path().replacen("/api/permission/delete/", "", 1);

    db.delete_permission(&permission_id, &requesting_user.user_id)
        .await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
