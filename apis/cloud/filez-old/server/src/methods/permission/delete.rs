use crate::{db::DB, internal_types::Auth, retry_transient_transaction_error};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Deletes a permission.

## Call
`/api/permission/delete/?id={permission_id}`

## Permissions
None

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezFile
Mutation > FilezUserGroup
Mutation > FilezUser
Mutation > FilezPermission

## Multiple Resources
Yes

## Atomicity
Yes

*/
pub async fn delete_permission(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let dprb = serde_json::from_slice::<DeletePermissionRequestBody>(&body)?;

    let permissions = db.get_permissions_by_id(&dprb.permission_ids).await?;

    if !permissions
        .iter()
        .all(|p| p.owner_id == requesting_user.user_id)
    {
        return Ok(res.status(401).body(Body::from("Unauthorized"))?);
    }

    retry_transient_transaction_error!(db.delete_permissions(&permissions).await);

    Ok(res.status(200).body(Body::from("Ok"))?)
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct DeletePermissionRequestBody {
    pub permission_ids: Vec<String>,
}
