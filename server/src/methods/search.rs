use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    types::{SearchRequest, SearchRequestType},
};
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

    match sr.search_type {
        SearchRequestType::SimpleSearch(ss) => {
            // a simple search will search through all fields
            // first searching through the indexed fields and
            // then the non-indexed fields if the limit was not reached
            // if the limit is 0 all results will be returned

            // TODO check query and limit

            let files = db.search(&ss.query, &ss.group_id, sr.limit).await?;

            //TODO filter files by owner

            Ok(res
                .status(200)
                .header("Content-Type", "application/json")
                .body(serde_json::to_string(&files)?.into())
                .unwrap())
        }
        SearchRequestType::AdvancedSearch(ads) => todo!(),
    }
}
