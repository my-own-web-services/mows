use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

pub async fn get_own_file_groups(
    _req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id.clone(),
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };

    let groups = db.get_file_groups_by_owner_id(&user_id).await?;

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&groups)?.into())
        .unwrap())
}
