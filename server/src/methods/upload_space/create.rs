use crate::{db::DB, internal_types::Auth, utils::generate_id};
use filez_common::server::{FileGroupType, FilezFileGroup, UploadSpace, UsageLimits};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

/**
# Creates an upload space for an authenticated user tied to them.

## Call
`/api/upload_space/create/`
## Permissions
None

*/
pub async fn create_upload_space(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);

    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let user_id = requesting_user.user_id;

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cusr: CreateUploadSpaceRequestBody = serde_json::from_slice(&body)?;

    let upload_space_id = generate_id(16);

    let mut limits = HashMap::new();

    for (storage_name, l) in cusr.limits {
        limits.insert(
            storage_name,
            UsageLimits {
                max_storage: l.max_storage,
                used_storage: 0,
                max_files: l.max_files,
                used_files: 0,
                max_bandwidth: l.max_bandwidth,
                used_bandwidth: 0,
            },
        );
    }

    let file_group_id = generate_id(16);

    let group = FilezFileGroup {
        owner_id: user_id.to_string(),
        name: None,
        file_group_id: file_group_id.clone(),
        permission_ids: vec![],
        keywords: vec![],
        group_hierarchy_paths: vec![],
        mime_types: vec![],
        group_type: FileGroupType::Static,
        item_count: 0,
        dynamic_group_rules: None,
        readonly: false,
    };

    db.create_file_group(&group).await?;

    // yes the user can set arbitrary limits here that are higher than their own limits
    // the check against their own limits and the uploadSpace limits will be performed on upload
    let upload_space = UploadSpace {
        upload_space_id,
        owner_id: user_id.clone(),
        limits,
        file_group_id,
    };

    db.create_upload_space(&upload_space).await?;

    Ok(Response::builder()
        .status(200)
        .body(Body::from("Created"))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]

pub struct CreateUploadSpaceRequestBody {
    pub limits: HashMap<String, CusrLimits>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CusrLimits {
    pub max_storage: u64,
    pub max_files: u64,
    pub max_bandwidth: u64,
}
