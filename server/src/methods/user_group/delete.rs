use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezUserGroupPermissionAclWhatOptions},
};
use anyhow::bail;
use hyper::{body::Body, Request, Response};

/**
# Delete a user group.

## Call
`/api/user_group/delete/`
## Permissions
UserGroup > DeleteGroup

*/
pub async fn delete_user_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_group_id = req.uri().path().replacen("/api/user_group/delete/", "", 1);

    let user_group = match db.get_user_group_by_id(&user_group_id).await? {
        Some(ug) => ug,
        None => return Ok(res.status(404).body(Body::from("User group not found"))?),
    };

    match check_auth(
        auth,
        &AuthResourceToCheck::UserGroup((
            &user_group,
            FilezUserGroupPermissionAclWhatOptions::DeleteGroup,
        )),
        &db,
    )
    .await
    {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    }

    db.delete_user_group(&user_group).await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
