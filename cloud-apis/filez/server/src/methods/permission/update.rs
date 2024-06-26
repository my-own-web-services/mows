use crate::{db::DB, internal_types::Auth, retry_transient_transaction_error};
use filez_common::server::permission::PermissionResourceType;
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/**
# Updates  a permission

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

    let mut permission = match db
        .get_permissions_by_id(&vec![cpr.permission_id])
        .await?
        .first()
    {
        Some(p) => p.clone(),
        None => return Ok(res.status(404).body(Body::from("Permission not found"))?),
    };

    if permission.owner_id != requesting_user.user_id {
        return Ok(res.status(401).body(Body::from("Unauthorized"))?);
    }

    // reject the request if the resource type was changed

    let old_type = match permission.content {
        PermissionResourceType::File(_) => "File",
        PermissionResourceType::FileGroup(_) => "FileGroup",
        PermissionResourceType::UserGroup(_) => "UserGroup",
        PermissionResourceType::User(_) => "User",
    };

    let new_type = match cpr.content {
        PermissionResourceType::File(_) => "File",
        PermissionResourceType::FileGroup(_) => "FileGroup",
        PermissionResourceType::UserGroup(_) => "UserGroup",
        PermissionResourceType::User(_) => "User",
    };

    if old_type != new_type {
        return Ok(res
            .status(400)
            .body(Body::from("Resource type cannot be changed"))?);
    }

    permission.content = cpr.content;
    permission.name = cpr.name.or(permission.name);

    retry_transient_transaction_error!(db.update_permission(&permission).await);

    let res_body = UpdatePermissionResponseBody {
        permission_id: permission.permission_id,
    };

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdatePermissionRequestBody {
    /*
    If an id is provided an existing permission will be updated
    */
    pub permission_id: String,
    pub name: Option<String>,
    pub content: PermissionResourceType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdatePermissionResponseBody {
    pub permission_id: String,
}
