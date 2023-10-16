use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

pub async fn get_aggregated_keywords(
    _req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let keywords = db.get_aggregated_keywords(user_id).await?;

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&keywords).unwrap()))?)
}
