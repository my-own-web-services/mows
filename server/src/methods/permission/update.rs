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
# Updates or creates a permission.

## Call
`/api/permission/update/`

## Permissions
None

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezFile
Mutation > FilezUserGroup
Mutation > FilezUser
Mutation > FilezPermission

## Multiple Resources
No // TODO

*/
pub async fn update_permission(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cpr: UpdatePermissionRequestBody = serde_json::from_slice(&body)?;

    match cpr._id {
        Some(id) => {
            let permission = match db.get_permission_by_id(&id).await? {
                Some(p) => p,
                None => return Ok(res.status(404).body(Body::from("Permission not found"))?),
            };

            if permission.owner_id != requesting_user.user_id {
                return Ok(res.status(401).body(Body::from("Unauthorized"))?);
            }

            let permission = FilezPermission {
                owner_id: requesting_user.user_id.to_string(),
                name: cpr.name.or(permission.name),
                permission_id: permission.permission_id,
                content: cpr.content,
                use_type: cpr.use_type,
            };

            retry_transient_transaction_error!(db.update_permission(&permission).await);

            let res_body = UpdatePermissionResponseBody {
                permission_id: permission.permission_id,
            };

            Ok(res
                .status(200)
                .body(Body::from(serde_json::to_string(&res_body)?))?)
        }
        None => {
            // TODO move this to own function for consistency

            let permission_id = generate_id(16);

            let permission = FilezPermission {
                owner_id: requesting_user.user_id.to_string(),
                name: cpr.name,
                permission_id: permission_id.clone(),
                content: cpr.content,
                use_type: cpr.use_type,
            };

            retry_transient_transaction_error!(db.create_permission(&permission).await);

            let res_body = UpdatePermissionResponseBody { permission_id };

            Ok(res
                .status(200)
                .body(Body::from(serde_json::to_string(&res_body)?))?)
        }
    }
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdatePermissionRequestBody {
    /*
    If an id is provided an existing permission will be updated
    */
    pub _id: Option<String>,
    pub name: Option<String>,
    pub content: PermissionResourceType,
    pub use_type: FilezPermissionUseType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdatePermissionResponseBody {
    pub permission_id: String,
}
