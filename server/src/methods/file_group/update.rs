use crate::{
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFileGroupPermissionAclWhatOptions},
    types::{FileGroupType, FilterRule},
};
use anyhow::bail;
use hyper::{Body, Request, Response};
use serde::{Deserialize, Serialize};
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

*/
pub async fn update_file_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
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

    match ufgr.field {
        UpdateFileGroupInfosRequestField::Name(name) => {
            match check_auth(
                auth,
                &AuthResourceToCheck::FileGroup((
                    &group,
                    FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosName,
                )),
                &db,
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
        UpdateFileGroupInfosRequestField::DynamicGroupRules(dynamic_group_rules) => {
            match check_auth(
                auth,
                &AuthResourceToCheck::FileGroup((
                    &group,
                    FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosDynamicGroupRules,
                )),
                &db,
            )
            .await
            {
                Ok(true) => {}
                Ok(false) => {
                    return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
                }
                Err(e) => bail!(e),
            };

            group.dynamic_group_rules = Some(dynamic_group_rules);
        }
        UpdateFileGroupInfosRequestField::GroupType(group_type) => {
            match check_auth(
                auth,
                &AuthResourceToCheck::FileGroup((
                    &group,
                    FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosGroupType,
                )),
                &db,
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
        }
        UpdateFileGroupInfosRequestField::Keywords(keywords) => {
            match check_auth(
                auth,
                &AuthResourceToCheck::FileGroup((
                    &group,
                    FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosKeywords,
                )),
                &db,
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
        }
        UpdateFileGroupInfosRequestField::MimeTypes(mime_types) => {
            match check_auth(
                auth,
                &AuthResourceToCheck::FileGroup((
                    &group,
                    FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosMimeTypes,
                )),
                &db,
            )
            .await
            {
                Ok(true) => {}
                Ok(false) => {
                    return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
                }
                Err(e) => bail!(e),
            };

            group.mime_types = mime_types;
        }
        UpdateFileGroupInfosRequestField::GroupHierarchyPaths(ghp) => {
            match check_auth(
                auth,
                &AuthResourceToCheck::FileGroup((
                    &group,
                    FilezFileGroupPermissionAclWhatOptions::UpdateGroupInfosGroupHierarchyPaths,
                )),
                &db,
            )
            .await
            {
                Ok(true) => {}
                Ok(false) => {
                    return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
                }
                Err(e) => bail!(e),
            };

            group.group_hierarchy_paths = ghp;
        }
    };

    db.update_file_group(&group).await?;

    handle_dynamic_group_update(&db, &UpdateType::Group(group)).await?;

    Ok(res.status(200).body(Body::from("Ok")).unwrap())
}

#[derive(TS, Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileGroupRequestBody {
    pub file_group_id: String,
    pub field: UpdateFileGroupInfosRequestField,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UpdateFileGroupInfosRequestField {
    Name(String),
    DynamicGroupRules(FilterRule),
    GroupType(FileGroupType),
    Keywords(Vec<String>),
    MimeTypes(Vec<String>),
    GroupHierarchyPaths(Vec<String>),
}
