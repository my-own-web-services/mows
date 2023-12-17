use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{
        check_auth, check_auth_multiple, AuthResourceToCheck, CommonAclWhatOptions,
        FilezFilePermissionAclWhatOptions,
    },
    retry_transient_transaction_error, some_or_bail,
    utils::get_query_item,
};
use anyhow::bail;
use filez_common::storage::index::get_storage_location_from_file;
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use tokio::fs;
use ts_rs::TS;
/**
# Deletes a single file by id.

## Call
`/api/file/delete/?id={file_id}`
## Permissions
File > DeleteFile

## Possible Mutations
Mutation > FilezFile
Mutation > FilezFileGroup
Mutation > FilezUser

## Multiple Resources
No // TODO

*/
pub async fn delete_file(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let file_ids = serde_json::from_slice::<DeleteFileRequestBody>(&body)?.file_ids;

    let files = db.get_files_by_ids(&file_ids).await?;

    if files.iter().any(|f| f.storage_id.is_none() || f.readonly) {
        bail!("Some files do not have an associated storage id or are readonly");
    };

    match check_auth_multiple(
        auth,
        &into_permissive_resource!(files),
        &CommonAclWhatOptions::File(FilezFilePermissionAclWhatOptions::DeleteFile),
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

    retry_transient_transaction_error!(db.delete_files_by_ids(&files).await);

    for file in files {
        let fl = get_storage_location_from_file(&config.storage, &file)?;
        fs::remove_file(fl.full_path).await?;
    }
    Ok(res.status(200).body(Body::from("Ok"))?)
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct DeleteFileRequestBody {
    pub file_ids: Vec<String>,
}
