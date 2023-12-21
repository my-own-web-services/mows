use crate::{
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{
        check_auth_multiple, CommonAclWhatOptions, FilezUserGroupPermissionAclWhatOptions,
    },
    retry_transient_transaction_error,
};
use anyhow::bail;
use hyper::{body::Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
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
Yes
*/
pub async fn delete_user_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;

    let dugrb = serde_json::from_slice::<DeleteUserGroupRequestBody>(&body)?;

    let user_groups = db.get_user_groups_by_id(&dugrb.group_ids).await?;

    match check_auth_multiple(
        auth,
        &into_permissive_resource!(user_groups),
        &CommonAclWhatOptions::UserGroup(FilezUserGroupPermissionAclWhatOptions::UserGroupDelete),
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

    retry_transient_transaction_error!(db.delete_user_groups(&user_groups).await);

    Ok(res.status(200).body(Body::from("Ok"))?)
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct DeleteUserGroupRequestBody {
    pub group_ids: Vec<String>,
}
