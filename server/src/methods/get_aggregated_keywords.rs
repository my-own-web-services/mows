use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

pub async fn get_aggregated_keywords(
    _req: Request<Body>,
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

    let keywords = db.get_aggregated_keywords(&requesting_user.user_id).await?;

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&keywords).unwrap()))?)
}
