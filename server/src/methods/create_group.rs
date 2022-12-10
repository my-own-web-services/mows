use crate::{
    db::DB,
    internal_types::Auth,
    types::{
        CreateGroupRequest, CreateGroupResponse, FileGroupType, FilezFileGroup, FilezGroups,
        FilezUserGroup,
    },
    utils::generate_id,
};
use hyper::{Body, Request, Response};

// creates a group for an authenticated user
pub async fn create_group(
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
    let cgr: CreateGroupRequest = serde_json::from_slice(&body)?;

    let group_id = generate_id();

    let group = match cgr.group_type {
        crate::types::GroupType::User => FilezGroups::FilezUserGroup(FilezUserGroup {
            owner_id: user_id.to_string(),
            name: cgr.name,
            user_group_id: group_id.clone(),
        }),
        crate::types::GroupType::File => FilezGroups::FilezFileGroup(FilezFileGroup {
            owner_id: user_id.to_string(),
            name: cgr.name,
            file_group_id: group_id.clone(),
            permission_ids: vec![],
            keywords: vec![],
            group_hierarchy_paths: vec![],
            mime_types: vec![],
            group_type: FileGroupType::Static,
            item_count: 0,
        }),
    };

    db.create_group(&group).await?;

    let res_body = CreateGroupResponse { group_id };

    Ok(Response::builder()
        .status(201)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}
