use crate::{
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFileGroupPermissionAclWhatOptions},
    retry_transient_transaction_error,
};
use anyhow::bail;
use filez_common::server::{FileGroupType, FilterRule};
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
use simple_server_timing_header::Timer;
use ts_rs::TS;

/**
# Updates a file groups infos.

## Call
`/api/file_group/update/`
## Permissions
FileGroup > UpdateGroupInfosName
FileGroup > UpdateGroupInfosDynamicGroupRules
FileGroup > UpdateGroupInfosGroupType
FileGroup > UpdateGroupInfosKeywords
FileGroup > UpdateGroupInfosMimeTypes
FileGroup > UpdateGroupInfosGroupHierarchyPaths

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezFile

## Multiple Resources
No // TODO

*/
pub async fn update_file_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let mut timer = Timer::new();

    crate::check_content_type_json!(req, res);

    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);
    timer.add("1 get_authenticated_user");

    let ufgr: UpdateFileGroupRequestBody =
        serde_json::from_slice(&hyper::body::to_bytes(req.into_body()).await?)?;

    let mut group = match db.get_file_group_by_id(&ufgr.file_group_id).await? {
        Some(g) => g,
        None => {
            return Ok(res
                .status(404)
                .body(Body::from("File group not found"))
                .unwrap())
        }
    };
    timer.add("2 get_file_group_by_id");

    if let Some(name) = ufgr.fields.name {
        match check_auth(
            auth,
            &AuthResourceToCheck::FileGroup((
                &group,
                FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosName,
            )),
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
    };

    if let Some(dynamic_group_rules) = ufgr.fields.dynamic_group_rules {
        match check_auth(
            auth,
            &AuthResourceToCheck::FileGroup((
                &group,
                FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosDynamicGroupRules,
            )),
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

        group.dynamic_group_rules = Some(dynamic_group_rules);
    };

    if let Some(group_type) = ufgr.fields.group_type {
        match check_auth(
            auth,
            &AuthResourceToCheck::FileGroup((
                &group,
                FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosGroupType,
            )),
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

        group.group_type = group_type;
    };

    if let Some(keywords) = ufgr.fields.keywords {
        match check_auth(
            auth,
            &AuthResourceToCheck::FileGroup((
                &group,
                FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosKeywords,
            )),
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

        group.keywords = keywords;
    };

    if let Some(mime_types) = ufgr.fields.mime_types {
        match check_auth(
            auth,
            &AuthResourceToCheck::FileGroup((
                &group,
                FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosMimeTypes,
            )),
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

        group.mime_types = mime_types;
    };

    if let Some(group_hierarchy_paths) = ufgr.fields.group_hierarchy_paths {
        match check_auth(
            auth,
            &AuthResourceToCheck::FileGroup((
                &group,
                FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosGroupHierarchyPaths,
            )),
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

        group.group_hierarchy_paths = group_hierarchy_paths;
    };

    if let Some(permission_ids) = ufgr.fields.permission_ids {
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
    timer.add("3 check_auth and handle updates");

    retry_transient_transaction_error!(db.update_file_group(&group).await);
    timer.add("4 write updates to db");

    handle_dynamic_group_update(
        db,
        &UpdateType::Group(vec![group]),
        &requesting_user.user_id,
    )
    .await?;
    timer.add("5 handle_dynamic_group_update");

    Ok(res
        .header("Server-Timing", timer.header_value())
        .status(200)
        .body(Body::from("Ok"))
        .unwrap())
}

#[derive(TS, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileGroupRequestBody {
    pub file_group_id: String,
    pub fields: UpdateFileGroupInfosRequestField,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileGroupInfosRequestField {
    pub name: Option<String>,
    pub dynamic_group_rules: Option<FilterRule>,
    pub group_type: Option<FileGroupType>,
    pub keywords: Option<Vec<String>>,
    pub mime_types: Option<Vec<String>>,
    pub group_hierarchy_paths: Option<Vec<String>>,
    pub permission_ids: Option<Vec<String>>,
}
