use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth, utils::merge_values};
use anyhow::bail;
use filez_common::server::permission::{
    CommonAclWhatOptions, FilezFilePermissionAclWhatOptions, FilezPermission,
    PermissionResourceSelectType, PermissionResourceType, PermissiveResource,
};
use itertools::Itertools;
use serde_json::Value;

pub async fn check_auth_multiple(
    auth: &Auth,
    auth_resources: &Vec<Box<dyn PermissiveResource>>,
    acl_what_options: &CommonAclWhatOptions,
    db: &DB,
) -> anyhow::Result<bool> {
    let config = &SERVER_CONFIG;

    let requesting_user = match &auth.authenticated_ir_user_id {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => bail!("User has not been created on the filez server, although it is present on the IR server. Run create_own first."),
        },
        None => return Ok(false),
    };

    // check if the requesting user is the owner of the resources
    let is_owner_of_all = auth_resources
        .iter()
        .all(|auth_resource| &requesting_user.user_id == auth_resource.get_owner_id());

    if is_owner_of_all {
        // user is the owner
        return Ok(true);
    };

    if config.dev.disable_complex_access_control {
        bail!("Complex access control has been disabled");
    };

    // get the permission ids of all resources and dedupe them
    let permission_ids = auth_resources
        .iter()
        .flat_map(|auth_resource| auth_resource.get_permission_ids().clone())
        .unique()
        .collect::<Vec<_>>();

    if let CommonAclWhatOptions::File(f) = acl_what_options {
        let field = match f {
            FilezFilePermissionAclWhatOptions::FileList => "FileList",
            FilezFilePermissionAclWhatOptions::FileGet => "FileGet",
            FilezFilePermissionAclWhatOptions::FileGetDerivatives => "FileGetDerivatives",
            FilezFilePermissionAclWhatOptions::FileGetInfos => "FileGetInfos",
            FilezFilePermissionAclWhatOptions::FileDelete => "FileDelete",
            FilezFilePermissionAclWhatOptions::FileUpdateInfosName => "FileUpdateInfosName",
            FilezFilePermissionAclWhatOptions::FileUpdateInfosMimeType => "FileUpdateInfosMimeType",
            FilezFilePermissionAclWhatOptions::FileUpdateInfosKeywords => "FileUpdateInfosKeywords",
            FilezFilePermissionAclWhatOptions::FileUpdateInfosStaticFileGroups => {
                "FileUpdateInfosStaticFileGroups"
            }
            FilezFilePermissionAclWhatOptions::FileUpdate => "FileUpdate",
        };

        let file_group_permissions = db
            .get_relevant_permissions_for_user_and_action(
                &requesting_user,
                field,
                Some(PermissionResourceSelectType::FileGroup),
            )
            .await?;

        // get all file groups that have one of the permissions
        let file_groups = db
            .get_file_groups_by_permission_ids(
                &file_group_permissions
                    .iter()
                    .map(|p| p.permission_id.clone())
                    .collect::<Vec<_>>(),
            )
            .await?;

        for resource in auth_resources {
            if let Some(file_group_ids) = resource.get_file_group_ids() {
                if file_groups
                    .iter()
                    .any(|fg| file_group_ids.contains(&fg.file_group_id))
                {
                    continue;
                }
            }
            return Ok(false);
        }
        return Ok(true);
    }

    // get all permissions that are relevant to this request at once
    let permissions = db.get_permissions_by_resource_ids(&permission_ids).await?;

    for auth_resource in auth_resources {
        // get the permissions now from the array that contains all permissions instead of querying the db each time
        let resource_permissions = permissions
            .iter()
            .filter(|p| {
                auth_resource
                    .get_permission_ids()
                    .contains(&p.permission_id)
            })
            .cloned()
            .collect::<Vec<_>>();

        // merge the permissions that are present on the resource
        let merged_permission_content = merge_permission_content(resource_permissions)?;

        let maybe_acl_who = match (merged_permission_content, acl_what_options) {
            (PermissionResourceType::File(prt), CommonAclWhatOptions::File(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            (PermissionResourceType::FileGroup(prt), CommonAclWhatOptions::FileGroup(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            (PermissionResourceType::UserGroup(prt), CommonAclWhatOptions::UserGroup(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            (PermissionResourceType::User(prt), CommonAclWhatOptions::User(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            _ => bail!("Permission type does not match resource type"),
        };

        if let Some(acl_who) = maybe_acl_who {
            if let Some(link) = acl_who.link {
                if link {
                    continue;
                }
            }
            if let Some(policy_passwords) = acl_who.passwords {
                if let Some(auth_password) = &auth.password {
                    if policy_passwords.contains(auth_password) {
                        continue;
                    }
                }
            }
            if acl_who.user_ids.contains(&requesting_user.user_id) {
                continue;
            }
            if requesting_user
                .user_group_ids
                .iter()
                .any(|user_group_id| acl_who.user_group_ids.contains(user_group_id))
            {
                continue;
            }
        }
        return Ok(false);
    }

    Ok(true)
}

pub fn merge_permission_content(
    permissions: Vec<FilezPermission>,
) -> anyhow::Result<PermissionResourceType> {
    if permissions.is_empty() {
        bail!("No permissions to merge");
    };

    let mut merged_permission_content = Value::Null;

    for permission in permissions {
        merge_values(
            &mut merged_permission_content,
            &serde_json::to_value(permission.content)?,
        );
    }

    let merged_permission_content: PermissionResourceType =
        serde_json::from_value(merged_permission_content)?;

    Ok(merged_permission_content)
}
