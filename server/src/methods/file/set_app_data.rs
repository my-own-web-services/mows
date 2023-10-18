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
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id.clone(),
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

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
