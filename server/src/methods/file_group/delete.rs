use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFileGroupPermissionAclWhatOptions},
    retry_transient_transaction_error,
    utils::get_query_item,
};
use anyhow::bail;
use hyper::{body::Body, Request, Response};

/**
# Deletes a file group.

## Call
`/api/file_group/delete/?id={group_id}`

## Permissions
FileGroup > DeleteGroup

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezFile
*/
pub async fn delete_file_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let file_group_id = match get_query_item(&req, "id") {
        Some(v) => v,
        None => return Ok(res.status(400).body(Body::from("Missing id"))?),
    };

    let file_group = match db.get_file_group_by_id(&file_group_id).await? {
        Some(fg) => fg,
        None => return Ok(res.status(404).body(Body::from("File group not found"))?),
    };

    match check_auth(
        auth,
        &AuthResourceToCheck::FileGroup((
            &file_group,
            FilezFileGroupPermissionAclWhatOptions::DeleteGroup,
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

    retry_transient_transaction_error!(db.delete_file_group(&file_group).await);

    Ok(res.status(200).body(Body::from("Ok"))?)
}
