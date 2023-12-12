use crate::{db::DB, internal_types::Auth, utils::generate_id};
use filez_common::server::{FilezUserGroup, Visibility};
use hyper::{body::Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Create a user group.

## Call
`/api/user_group/create/`
## Permissions
None

*/
pub async fn create_user_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let cgr: CreateUserGroupRequestBody = serde_json::from_slice(&body)?;

    let group_id = generate_id(16);

    let user_group = FilezUserGroup {
        owner_id: requesting_user.user_id.to_string(),
        name: cgr.name,
        user_group_id: group_id.clone(),
        visibility: cgr.visibility,
        permission_ids: cgr.permission_ids,
    };

    db.create_user_group(&user_group).await?;

    let res_body = CreateUserGroupResponseBody { group_id };

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateUserGroupRequestBody {
    pub name: Option<String>,
    pub visibility: Visibility,
    pub permission_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateUserGroupResponseBody {
    pub group_id: String,
}
