use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth, types::SearchRequest};
use hyper::{Body, Request, Response};

pub async fn search(
    mut req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let user = db.get_user_by_id(user_id).await?;
    let body = hyper::body::to_bytes(req.into_body()).await?;

    let sr: SearchRequest = serde_json::from_slice(&body)?;

    match sr {
        SearchRequest::SimpleSearch(ss) => {
            // a simple search will search through all fields
        }
        SearchRequest::AdvancedSearch(ads) => todo!(),
    }

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&"search")?.into())
        .unwrap())
}
