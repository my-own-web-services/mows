use crate::{
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{check_auth_multiple, FilezFileGroupPermissionAclWhatOptions},
    retry_transient_transaction_error,
};
use anyhow::bail;
use hyper::{body::Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Deletes a file group.

## Call
`/api/file_group/delete/`

## Permissions
FileGroup > DeleteGroup

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezFile

## Multiple Resources
Yes
*/
pub async fn delete_file_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let dfgrb = serde_json::from_slice::<DeleteFileGroupRequestBody>(&body)?;

    let file_groups = db.get_file_groups_by_ids(&dfgrb.group_ids).await?;

    match check_auth_multiple(
        auth,
        &into_permissive_resource!(file_groups),
        &crate::permissions::CommonAclWhatOptions::FileGroup(
            FilezFileGroupPermissionAclWhatOptions::DeleteGroup,
        ),
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

    retry_transient_transaction_error!(db.delete_file_groups(&file_groups).await);

    Ok(res.status(200).body(Body::from("Ok"))?)
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct DeleteFileGroupRequestBody {
    pub group_ids: Vec<String>,
}
