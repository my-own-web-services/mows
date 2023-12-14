use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{
        check_auth_multiple, CommonAclWhatOptions, FilezFileGroupPermissionAclWhatOptions,
    },
    some_or_bail,
};
use anyhow::bail;
use filez_common::server::PermissiveResource;
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub async fn get_file_groups(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;

    // TODO make this work for dynamic and static file groups, currently it is only static

    let file_group_ids = some_or_bail!(
        serde_json::from_slice::<GetFileGroupsRequestBody>(&body)
            .map(|x| x.file_group_ids)
            .ok(),
        "Invalid request body"
    );

    let file_groups = db
        .get_static_file_groups_by_ids(&file_group_ids)
        .await?
        .iter()
        .map(|file_group| Box::new((*file_group).clone()) as Box<dyn PermissiveResource>)
        .collect();

    match check_auth_multiple(
        auth,
        &file_groups,
        &CommonAclWhatOptions::FileGroup(FilezFileGroupPermissionAclWhatOptions::GetGroupInfos),
        &db,
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
        .body(Body::from(
            serde_json::to_string(&GetFileGroupsResponseBody { file_groups }).unwrap(),
        ))
        .unwrap())
}

#[derive(Serialize, Deserialize, Debug, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct GetFileGroupsRequestBody {
    pub file_group_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct GetFileGroupsResponseBody {
    #[ts(type = "FilezFileGroup[]")]
    pub file_groups: Vec<Box<dyn PermissiveResource>>,
}
