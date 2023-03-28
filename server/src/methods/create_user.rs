use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth};
use hyper::{Body, Request, Response};

// create self user for an IR user assertion with default limits
pub async fn create_user(
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

    match db.create_user(user_id).await {
        Ok(_) => Ok(res.status(201).body(Body::from("OK"))?),
        Err(e) => {
            if e.to_string() == "User already exists" {
                Ok(res
                    .status(200)
                    .body(Body::from("User exists but ok cool"))?)
            } else {
                Ok(res.status(400).body(Body::from(e.to_string()))?)
            }
        }
    }
}
