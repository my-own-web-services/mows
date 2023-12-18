use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{check_auth_multiple, CommonAclWhatOptions, FilezFilePermissionAclWhatOptions},
    retry_transient_transaction_error,
};
use anyhow::bail;
use filez_common::storage::index::get_storage_location_from_file;
use futures::{future::join_all, Future};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use simple_server_timing_header::Timer;
use tokio::fs;
use ts_rs::TS;
/**
# Deletes the given files by id

## Call
`/api/file/delete/`
## Permissions
File > DeleteFile

## Possible Mutations
Mutation > FilezFile
Mutation > FilezFileGroup
Mutation > FilezUser

## Multiple Resources
Yes

## Atomicity
Yes on database level, no on storage level

*/
pub async fn delete_file(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let mut timer = Timer::new();
    let config = &SERVER_CONFIG;
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let file_ids = serde_json::from_slice::<DeleteFileRequestBody>(&body)?.file_ids;

    // TODO update db in chunks for large delete requests this takes forever as it does not scale linearly

    let files = db.get_files_by_ids(&file_ids).await?;

    timer.add("10 Getting files from db");

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
    timer.add("20 Check auth");

    retry_transient_transaction_error!(db.delete_files_by_ids(&files).await);
    timer.add("30 Delete files from db");

    // delete files in chunks of 1000
    for chunk in files.chunks(1000) {
        let mut futures = Vec::new();
        for file in chunk {
            let fl = get_storage_location_from_file(&config.storage, file)?;
            futures.push(fs::remove_file(fl.full_path));
        }
        join_all(futures).await;
    }
    timer.add("40 Delete files from storage");

    Ok(res
        .status(200)
        .header("Server-Timing", timer.header_value())
        .body(Body::from("Ok"))?)
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct DeleteFileRequestBody {
    pub file_ids: Vec<String>,
}
