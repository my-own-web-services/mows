use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezUserGroupPermissionAclWhatOptions},
    retry_transient_transaction_error,
    utils::get_query_item,
};
use anyhow::bail;
use hyper::{body::Body, Request, Response};

/**
# Delete a user group.

## Call
`/api/user_group/delete/?id={user_group_id}`

## Permissions
UserGroup > DeleteGroup

## Possible Mutations
Mutation > FilezUserGroup
Mutation > FilezUser

## Multiple Resources
No // TODO


*/
pub async fn delete_user_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_group_id = match get_query_item(&req, "id") {
        Some(v) => v,
        None => return Ok(res.status(400).body(Body::from("Missing id"))?),
    };

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
        db,
    )
    .await
    {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    }

    retry_transient_transaction_error!(db.delete_user_group(&user_group).await);

    Ok(res.status(200).body(Body::from("Ok"))?)
}
