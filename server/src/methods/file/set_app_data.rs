use crate::{
    db::DB,
    internal_types::Auth,
    some_or_bail,
    types::{AppDataType, SetAppDataRequest},
};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn set_app_data(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = match &auth.authenticated_user {
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
