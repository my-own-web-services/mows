use crate::{
    db::DB,
    types::{AppDataType, SetAppDataRequest},
};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn set_app_data(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let sadr: SetAppDataRequest = serde_json::from_slice(&body)?;

    let entity_id = match sadr.app_data_type {
        AppDataType::User => sadr.id.clone(),
        AppDataType::File => db.get_file_by_id(&sadr.id).await?.owner_id,
    };

    if user_id != entity_id {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file or user data");
    }

    db.set_app_data(sadr).await?;

    Ok(Response::builder()
        .status(200)
        .body(Body::from("OK"))
        .unwrap())
}
