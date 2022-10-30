use crate::{
    db::DB,
    internal_types::Auth,
    types::{CreateUploadSpaceRequest, FilezFileGroup, FilezGroups, UploadSpace, UsageLimits},
    utils::generate_id,
};
use hyper::{Body, Request, Response};
use std::collections::HashMap;

pub async fn create_upload_space(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cusr: CreateUploadSpaceRequest = serde_json::from_slice(&body)?;

    let upload_space_id = generate_id();

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

    let file_group_id = generate_id();

    let group = FilezGroups::FilezFileGroup(FilezFileGroup {
        owner_id: user_id.to_string(),
        name: None,
        file_group_id: file_group_id.clone(),
        permission_ids: vec![],
    });

    db.create_group(&group).await?;

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
