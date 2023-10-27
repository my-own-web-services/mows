use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFilePermissionAclWhatOptions},
    some_or_bail,
};
use anyhow::bail;
use hyper::{Body, Request, Response};
use tokio::fs;

/**
# Deletes a single file by id.

## Call
`/api/file/delete/{file_id}`
## Permissions
File > DeleteFile
*/
pub async fn delete_file(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let file_id = req.uri().path().replacen("/api/file/delete/", "", 1);

    let file = some_or_bail!(db.get_file_by_id(&file_id).await?, "File not found");

    match check_auth(
        auth,
        &AuthResourceToCheck::File((&file, FilezFilePermissionAclWhatOptions::DeleteFile)),
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

    db.delete_file_by_id(&file).await?;
    fs::remove_file(&file.path).await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}
