use super::list::user_to_reduced_user;
use crate::{
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{check_auth_multiple, CommonAclWhatOptions, FilezUserPermissionAclWhatOptions},
};
use anyhow::bail;
use filez_common::server::user::{FilezUser, ReducedFilezUser};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/**
# Get own user infos.

## Call
`/api/user/get/`

## Permissions
None

## Multiple Resources
Yes

*/
pub async fn get_user(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let gurb = serde_json::from_slice::<GetUserRequestBody>(&body)?;

    if gurb.user_ids.is_empty() {
        return Ok(res
            .status(200)
            .header("Content-Type", "application/json")
            .body(
                serde_json::to_string(&GetUserResponseBody {
                    full_users: Some(vec![requesting_user.clone()]),
                    reduced_users: None,
                })?
                .into(),
            )
            .unwrap());
    }

    let users = db.get_users_by_id(&gurb.user_ids).await?;

    match check_auth_multiple(
        auth,
        &into_permissive_resource!(users.clone()),
        &CommonAclWhatOptions::User(FilezUserPermissionAclWhatOptions::UserGet),
        db,
    )
    .await
    {
        Ok(true) => {}
        Ok(false) => {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        Err(e) => bail!(e),
    };

    let res_body = match requesting_user.role {
        filez_common::server::user::UserRole::Admin => GetUserResponseBody {
            full_users: Some(users),
            reduced_users: None,
        },
        filez_common::server::user::UserRole::User => GetUserResponseBody {
            reduced_users: Some(
                users
                    .into_iter()
                    .map(|u| user_to_reduced_user(u, &requesting_user))
                    .collect::<Vec<ReducedFilezUser>>(),
            ),
            full_users: None,
        },
    };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct GetUserRequestBody {
    user_ids: Vec<String>,
}

#[derive(Deserialize, Serialize, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct GetUserResponseBody {
    pub reduced_users: Option<Vec<ReducedFilezUser>>,
    pub full_users: Option<Vec<FilezUser>>,
}
