use crate::{
    db::DB,
    types::{CreateGroupRequest, CreateGroupResponse, FilezFileGroup, FilezGroups, FilezUserGroup},
    utils::generate_id,
};
use hyper::{Body, Request, Response};

pub async fn create_group(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cgr: CreateGroupRequest = serde_json::from_slice(&body)?;

    let group_id = generate_id();

    let group = match cgr.group_type {
        crate::types::CreateGroupRequestGroupType::User => {
            FilezGroups::FilezUserGroup(FilezUserGroup {
                owner_id: user_id.to_string(),
                name: cgr.name,
                user_group_id: group_id.clone(),
            })
        }
        crate::types::CreateGroupRequestGroupType::File => {
            FilezGroups::FilezFileGroup(FilezFileGroup {
                owner_id: user_id.to_string(),
                name: cgr.name,
                file_group_id: group_id.clone(),
                permission_ids: vec![],
            })
        }
    };

    db.create_group(&group).await?;

    let res_body = CreateGroupResponse { group_id };

    Ok(Response::builder()
        .status(201)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}
