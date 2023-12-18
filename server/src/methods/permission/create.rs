use crate::{
    db::DB,
    internal_types::Auth,
    permissions::{FilezPermission, FilezPermissionUseType, PermissionResourceType},
    retry_transient_transaction_error,
    utils::generate_id,
};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/**
# Creates a permission

## Call
`/api/permission/create/`

## Permissions
None

## Possible Mutations
Mutation > FilezPermission

## Multiple Resources
No

*/
pub async fn create_permission(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cpr: CreatePermissionRequestBody = serde_json::from_slice(&body)?;

    let permission_id = generate_id(16);

    let permission = FilezPermission {
        owner_id: requesting_user.user_id.to_string(),
        name: cpr.name,
        permission_id: permission_id.clone(),
        content: cpr.content,
        use_type: cpr.use_type,
    };

    retry_transient_transaction_error!(db.create_permission(&permission).await);

    let res_body = CreatePermissionResponseBody { permission_id };

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreatePermissionRequestBody {
    pub name: Option<String>,
    pub content: PermissionResourceType,
    pub use_type: FilezPermissionUseType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreatePermissionResponseBody {
    pub permission_id: String,
}
