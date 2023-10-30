use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

pub async fn get_aggregated_keywords(
    _req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let keywords = db.get_aggregated_keywords(&requesting_user.user_id).await?;

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&keywords).unwrap()))?)
}
