use crate::{
    db::DB,
    types::{AppDataType, SetAppDataRequest},
};
use anyhow::bail;
use arangors::Connection;
use hyper::{Body, Request, Response};

pub async fn set_app_data(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";

    if req.method() != hyper::Method::POST {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let sadr: SetAppDataRequest = serde_json::from_slice(&body)?;

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let entity_id = match sadr.app_data_type {
        AppDataType::User => sadr.id.clone(),
        AppDataType::File => db.get_file_by_id(&sadr.id).await?.owner,
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
