use crate::{db::DB, internal_types::Auth, types::FileResourceType};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
// update permission ids on resource: either fileGroup or file
// a user can only update permissions on a resource if they are the owner of the resource and the permission
pub async fn update_permission_ids_on_resource(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let upr: UpdatePermissionIdsOnResourceRequestBody = serde_json::from_slice(&body)?;

    db.update_permission_ids_on_resource(&upr, &requesting_user.user_id)
        .await?;

    Ok(res.status(200).body(Body::from("OK"))?)
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdatePermissionIdsOnResourceRequestBody {
    pub permission_ids: Vec<String>,
    pub resource_id: String,
    pub resource_type: FileResourceType,
}
