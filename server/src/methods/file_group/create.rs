use crate::{
    db::DB,
    internal_types::Auth,
    types::{FileGroupType, FilezFileGroup, Visibility},
    utils::generate_id,
};
use hyper::{body::Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Creates a new file group.

## Call
`/api/file_group/create/`
## Permissions
None
*/
pub async fn create_file_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = match &auth.authenticated_ir_user_id {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => return Ok(res.status(412).body(Body::from("User has not been created on the filez server, although it is present on the IR server. Run create_own first."))?),
        },
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let cgr: CreateFileGroupRequestBody = serde_json::from_slice(&body)?;

    let group_id = generate_id(16);

    let file_group = FilezFileGroup {
        owner_id: requesting_user.user_id.to_string(),
        name: cgr.name,
        file_group_id: group_id.clone(),
        permission_ids: vec![],
        keywords: vec![],
        group_hierarchy_paths: vec![],
        mime_types: vec![],
        group_type: FileGroupType::Static,
        item_count: 0,
        dynamic_group_rules: None,
    };

    db.create_file_group(&file_group).await?;

    let res_body = CreateFileGroupResponseBody { group_id };

    Ok(res
        .status(201)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileGroupResponseBody {
    pub group_id: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileGroupRequestBody {
    pub name: Option<String>,
    pub visibility: Visibility,
}
