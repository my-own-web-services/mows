use crate::{
    db::DB,
    internal_types::Auth,
    types::{
        CreateUploadSpaceRequestBody, FileGroupType, FilezFileGroup, UploadSpace, UsageLimits,
    },
    utils::generate_id,
};
use hyper::{Body, Request, Response};
use std::collections::HashMap;

// creates an upload space for an authenticated user tied to them
pub async fn create_upload_space(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = match &auth.authenticated_user {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => return Ok(res.status(412).body(Body::from("User has not been created on the filez server, although it is present on the IR server. Run create_own first."))?),
        },
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

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
        .status(201)
        .body(Body::from("Created"))?)
}
