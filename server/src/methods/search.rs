use crate::{db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

pub async fn search(
    mut req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&"search")?.into())
        .unwrap())
}
