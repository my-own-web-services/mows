use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

/**
# Get own user infos.

## Call
`/api/user/get_own/`
## Permissions
None

*/
pub async fn get_own_user(
    _req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let user = db.get_user_by_id(&requesting_user.user_id).await?;

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&user)?.into())
        .unwrap())
}
