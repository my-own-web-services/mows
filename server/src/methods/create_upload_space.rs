use hyper::{Body, Request, Response};

use crate::{
    db::DB,
    internal_types::Auth,
    types::{CreateUploadSpaceRequest, UploadSpace},
    utils::generate_id,
};

pub async fn create_upload_space(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let cusr: CreateUploadSpaceRequest = serde_json::from_slice(&body)?;

    let upload_space_id = generate_id();

    let upload_space = UploadSpace {
        upload_space_id,
        owner_id: user_id.clone(),
        limits: cusr.limits,
    };

    db.create_upload_space(&upload_space).await?;

    Ok(Response::builder()
        .status(201)
        .body(Body::from("Created"))?)
}
