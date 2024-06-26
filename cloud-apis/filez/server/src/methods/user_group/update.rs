use crate::{
    db::DB, internal_types::Auth, into_permissive_resource, permissions::check_auth_multiple,
    retry_transient_transaction_error,
};
use anyhow::bail;
use filez_common::server::{
    permission::{CommonAclWhatOptions, FilezUserGroupPermissionAclWhatOptions},
    user_group::UserGroupVisibility,
};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Updates a user groups infos.

## Call
`/api/user_group/update/`

## Permissions
UserGroup > UpdateGroupInfosName
UserGroup > UpdateGroupInfosVisibility

## Possible Mutations
Mutation > FilezUserGroup
Mutation > FilezUser

## Multiple Resources
No // TODO
*/
pub async fn update_user_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);

    let uugr: UpdateUserGroupRequestBody =
        serde_json::from_slice(&hyper::body::to_bytes(req.into_body()).await?)?;

    let mut group = match db
        .get_user_groups_by_id(&vec![uugr.user_group_id])
        .await?
        .first()
    {
        Some(g) => g.clone(),
        None => {
            return Ok(res
                .status(404)
                .body(Body::from("User group not found"))
                .unwrap())
        }
    };

    if let Some(name) = uugr.fields.name {
        match check_auth_multiple(
            auth,
            &into_permissive_resource!(&[group.clone()]),
            &CommonAclWhatOptions::UserGroup(
                FilezUserGroupPermissionAclWhatOptions::UserGroupUpdateInfosName,
            ),
            db,
        )
        .await
        {
            Ok(true) => {}
            Ok(false) => {
                return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
            }
            Err(e) => bail!(e),
        }

        group.name = Some(name);
    }

    if let Some(visibility) = uugr.fields.visibility {
        match check_auth_multiple(
            auth,
            &into_permissive_resource!(&[group.clone()]),
            &CommonAclWhatOptions::UserGroup(
                FilezUserGroupPermissionAclWhatOptions::UserGroupUpdateInfosVisibility,
            ),
            db,
        )
        .await
        {
            Ok(true) => {}
            Ok(false) => {
                return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
            }
            Err(e) => bail!(e),
        }

        group.visibility = visibility;
    }

    if let Some(permission_ids) = uugr.fields.permission_ids {
        let requesting_user = match &auth.authenticated_ir_user_id {
            Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
                Some(u) => u,
                None => bail!("User has not been created on the filez server, although it is present on the IR server. Run create_own first."),
            },
            None =>  return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap()),
        };

        if requesting_user.user_id != group.owner_id {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        // check if all permissions are from this user
        let permissions = db.get_permissions_by_resource_ids(&permission_ids).await?;
        for permission in permissions {
            if permission.owner_id != requesting_user.user_id {
                return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
            }
        }

        group.permission_ids = permission_ids;
    }

    retry_transient_transaction_error!(db.update_user_group(&group).await);

    Ok(res.status(200).body(Body::from("Ok")).unwrap())
}

#[derive(TS, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateUserGroupRequestBody {
    pub user_group_id: String,
    pub fields: UpdateUserGroupInfosRequestField,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateUserGroupInfosRequestField {
    pub name: Option<String>,
    pub visibility: Option<UserGroupVisibility>,
    pub permission_ids: Option<Vec<String>>,
}
