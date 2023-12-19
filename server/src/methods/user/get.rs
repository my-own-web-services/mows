use crate::{
    db::DB,
    internal_types::Auth,
    into_permissive_resource,
    permissions::{check_auth_multiple, CommonAclWhatOptions, FilezUserPermissionAclWhatOptions},
};
use anyhow::bail;
use filez_common::server::PermissiveResource;
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
                    users: vec![Box::new(requesting_user)],
                })?
                .into(),
            )
            .unwrap());
    }

    let users = into_permissive_resource!(db.get_users_by_id(&gurb.user_ids).await?);

    match check_auth_multiple(
        auth,
        &users,
        &CommonAclWhatOptions::User(FilezUserPermissionAclWhatOptions::GetUser),
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

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&GetUserResponseBody { users })?.into())
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
    #[ts(type = "FilezUser[]")]
    pub users: Vec<Box<dyn PermissiveResource>>,
}
