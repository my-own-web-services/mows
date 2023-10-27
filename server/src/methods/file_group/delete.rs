use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFileGroupPermissionAclWhatOptions},
};
use anyhow::bail;
use hyper::{body::Body, Request, Response};

/**
# Deletes a file group.

## Call
`/api/file_group/delete/`
## Permissions
FileGroup > DeleteGroup
*/
pub async fn delete_file_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let file_group_id = req.uri().path().replacen("/api/file_group/delete/", "", 1);

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

    db.delete_file_group(&file_group).await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
