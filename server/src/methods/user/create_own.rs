use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth};
use anyhow::bail;
use hyper::{Body, Request, Response};

/**
# Create self user for an IR user assertion with default limits.

## Call
`/api/user/create_own/`
## Permissions
None

*/
pub async fn create_own_user(
    mut _req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let ir_user_id = match &auth.authenticated_ir_user_id {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let ir_email = auth
        .user_assertion
        .as_ref()
        .map(|ua| ua.ir_email.clone())
        .unwrap_or("".to_string());

    match db.get_user_by_ir_id(ir_user_id).await? {
        Some(_) => Ok(res
            .status(200)
            .body(Body::from("User exists but ok cool"))?),
        None => match db.get_user_by_email(&ir_email).await? {
            Some(u) => match db.link_ir_user(&u.user_id, ir_user_id).await {
                Ok(_) => Ok(res.status(202).body(Body::from("Linked IR User"))?),
                Err(e) => bail!("Error linking IR user: {:?}", e),
            },
            None => match config.users.allow_new {
                true => {
                    db.create_user(Some(ir_user_id.to_string()), None, None, Some(ir_email))
                        .await?;
                    Ok(res.status(201).body(Body::from("Created User"))?)
                }
                false => Ok(res.status(403).body(Body::from("New users not allowed"))?),
            },
        },
    }
}
