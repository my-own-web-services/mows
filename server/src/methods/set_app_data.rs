use crate::{db::DB, internal_types::Auth, some_or_bail, types::AppDataType};
use anyhow::bail;
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

/**
# Sets the app data of a file or user.

## Call
`/api/set_app_data/`
## Permissions
None, can only be called by the owner of the file or user.
*/
pub async fn set_app_data(
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

    let user_id = requesting_user.user_id;

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let sadr: SetAppDataRequest = serde_json::from_slice(&body)?;

    let entity_id = match sadr.app_data_type {
        AppDataType::User => sadr.id.clone(),
        AppDataType::File => {
            some_or_bail!(db.get_file_by_id(&sadr.id).await?, "File not found").owner_id
        }
    };

    if user_id != entity_id {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file or user data");
    }

    db.set_app_data(sadr).await?;

    Ok(res.status(200).body(Body::from("OK")).unwrap())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]

pub struct SetAppDataRequest {
    pub app_data_type: AppDataType,
    pub id: String,
    pub app_name: String,
    #[ts(type = "any")]
    pub app_data: Value,
}
