use crate::{
    db::DB,
    internal_types::Auth,
    types::{SearchRequestBody, SearchType},
    utils::{check_search_limit, check_search_query, filter_files_by_owner_id},
};
use hyper::{Body, Request, Response};

pub async fn search(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    //let user = db.get_user_by_id(user_id).await?;
    let body = hyper::body::to_bytes(req.into_body()).await?;

    let sr: SearchRequestBody = serde_json::from_slice(&body)?;

    check_search_limit(sr.limit)?;

    match sr.search_type {
        SearchType::SimpleSearch(ss) => {
            // a simple search will search through all fields
            // first searching through the indexed fields and
            // then the non-indexed fields if the limit was not reached
            // if the limit is 0 all results will be returned

            check_search_query(&ss.query)?;

            let files = db.search(&ss.query, &ss.group_id, sr.limit).await?;

            // filter files by owner
            let filtered_files = filter_files_by_owner_id(&files, user_id);

            Ok(res
                .status(200)
                .header("Content-Type", "application/json")
                .body(serde_json::to_string(&filtered_files)?.into())
                .unwrap())
        }
        SearchType::AdvancedSearch(_ads) => todo!(),
    }
}
