use crate::{
    config::SERVER_CONFIG, db::DB, internal_types::Auth, retry_transient_transaction_error,
};
use anyhow::bail;
use filez_common::server::{FilezUser, UserStatus};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Create self or other users.

## Call
`/api/user/create/`

## Permissions
None

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezUser

## Multiple Resources
Yes

*/
pub async fn create_user(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let curb: CreateUserRequestBody = serde_json::from_slice(&body)?;

    let ir_user_id = match &auth.authenticated_ir_user_id {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    if curb.users.is_empty() {
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
                Some(u) => match u.status {
                    UserStatus::Invited => match db.link_ir_user(&u.user_id, ir_user_id).await {
                        Ok(_) => Ok(res.status(200).body(Body::from("Linked IR User"))?),
                        Err(e) => bail!("Error linking IR user: {:?}", e),
                    },
                    UserStatus::InvitationRequested => Ok(res
                        .status(403)
                        .body(Body::from("Invitation requested but not approved by admin"))?),
                    UserStatus::Placeholder => Ok(res
                        .status(403)
                        .body(Body::from("Invitation not requested"))?),
                    UserStatus::Removed => Ok(res.status(403).body(Body::from("Removed"))?),
                    UserStatus::Active => bail!("This should not happen"),
                },
                None => match config.users.allow_new {
                    true => {
                        let new_user = FilezUser::new(
                            &config.storage,
                            None,
                            Some(ir_email.clone()),
                            Some(ir_user_id.clone()),
                        );
                        retry_transient_transaction_error!(
                            db.create_users(&vec![new_user.clone()]).await
                        );
                        Ok(res.status(200).body(Body::from("Created User"))?)
                    }
                    false => Ok(res.status(403).body(Body::from("New users not allowed"))?),
                },
            },
        }
    } else {
        let mut new_users: Vec<FilezUser> = vec![];

        for user_to_be_created in curb.users {
            new_users.push(FilezUser::new(
                &config.storage,
                user_to_be_created.name,
                user_to_be_created.email,
                None,
            ));
        }
        retry_transient_transaction_error!(db.create_users(&new_users).await);

        Ok(res.status(200).body(Body::from("Ok"))?)
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateUserRequestBody {
    pub users: Vec<UserToBeCreated>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UserToBeCreated {
    pub name: Option<String>,
    pub email: Option<String>,
}
