use crate::{
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{check_auth_multiple, CommonAclWhatOptions, FilezFilePermissionAclWhatOptions},
    some_or_bail,
};
use anyhow::bail;
use filez_common::server::PermissiveResource;
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/**
# Gets infomartion about given files

## Call
`/api/file/info/get/`

## Permissions
File > GetFileInfos

## Possible Mutations
Mutation > None

## Multiple Resources
Yes

*/
pub async fn get_file_infos(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;

    let file_ids = some_or_bail!(
        serde_json::from_slice::<GetFileInfosRequestBody>(&body)
            .map(|x| x.file_ids)
            .ok(),
        "Invalid request body"
    );

    let files = into_permissive_resource!(db.get_files_by_ids(&file_ids).await?);

    match check_auth_multiple(
        auth,
        &files,
        &CommonAclWhatOptions::File(FilezFilePermissionAclWhatOptions::GetFileInfos),
        db,
    )
    .await
    {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&GetFileInfosResponseBody { files })?.into())
        .unwrap())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct GetFileInfosRequestBody {
    file_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct GetFileInfosResponseBody {
    #[ts(type = "FilezFile[]")]
    pub files: Vec<Box<dyn PermissiveResource>>,
}
