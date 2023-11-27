use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFilePermissionAclWhatOptions},
    some_or_bail,
    utils::{
        check_file_name, check_keywords, check_mime_type, check_owner_id, check_static_file_groups,
        check_storage_id,
    },
};
use anyhow::bail;
use filez_common::storage::index::{get_future_storage_location, get_storage_location_from_file};
use hyper::{Body, Request, Response};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use tokio::fs;
use ts_rs::TS;
/**
# Updates the infos of a file.

## Call
`/api/file/info/update/`
## Permissions
File > UpdateFileInfosName
File > UpdateFileInfosMimeType
File > UpdateFileInfosStaticFileGroups
File > UpdateFileInfosKeywords


*/
pub async fn update_file_infos(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    crate::check_content_type_json!(req, res);

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let ufir: UpdateFileInfosRequest = serde_json::from_slice(&body)?;

    let filez_file = match db.get_file_by_id(&ufir.file_id).await {
        Ok(file) => some_or_bail!(file, "File not found"),
        Err(_) => bail!("File not found"),
    };

    if let Some(new_mime_type) = &ufir.fields.mime_type {
        check_mime_type(new_mime_type)?;

        match check_auth(
            auth,
            &AuthResourceToCheck::File((
                &filez_file,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosMimeType,
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
        db.update_file_mime_type(&filez_file.file_id, new_mime_type)
            .await?;
    };

    if let Some(new_name) = &ufir.fields.name {
        check_file_name(new_name)?;

        match check_auth(
            auth,
            &AuthResourceToCheck::File((
                &filez_file,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosName,
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
        db.update_file_name(&filez_file.file_id, new_name).await?;
    };

    if let Some(new_static_file_group_ids) = &ufir.fields.static_file_group_ids {
        check_static_file_groups(new_static_file_group_ids)?;
        match check_auth(
            auth,
            &AuthResourceToCheck::File((
                &filez_file,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosStaticFileGroups,
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
        db.check_file_group_existence(new_static_file_group_ids)
            .await?;

        db.update_file_static_file_group_ids(&filez_file.file_id, new_static_file_group_ids)
            .await?;
    };

    if let Some(new_keywords) = &ufir.fields.keywords {
        check_keywords(new_keywords)?;

        match check_auth(
            auth,
            &AuthResourceToCheck::File((
                &filez_file,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosKeywords,
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

        let new_keywords = new_keywords
            .iter()
            .map(|k| {
                if k.contains('>') {
                    // trim whitespace in front and after the > character
                    k.split('>')
                        .map(|s| s.trim())
                        .collect::<Vec<&str>>()
                        .join(">")
                } else {
                    k.trim().to_string()
                }
            })
            .filter(|k| !k.is_empty())
            .unique()
            .collect::<Vec<String>>();
        db.update_file_keywords(&filez_file.file_id, &new_keywords)
            .await?;
    };

    if let Some(new_owner_id) = &ufir.fields.owner_id {
        // check if the file is owned by the user
        if let Some(requesting_user_id) = &auth.authenticated_ir_user_id {
            if requesting_user_id == &filez_file.owner_id {
                // mark the file as in transfer
                // the new owner has to accept the transfer
                check_owner_id(new_owner_id)?;

                if db.get_user_by_id(new_owner_id).await?.is_none() {
                    bail!("New owner does not exist")
                }

                db.update_pending_new_owner_id(&filez_file.file_id, new_owner_id)
                    .await?;
            }
        }
    };

    if let Some(new_storage_id) = &ufir.fields.storage_id {
        if let Some(requesting_user_id) = &auth.authenticated_ir_user_id {
            if requesting_user_id == &filez_file.owner_id {
                // check if storage id is valid
                check_storage_id(new_storage_id)?;

                if filez_file.readonly {
                    bail!("File is readonly")
                }

                // check if storage path exists
                some_or_bail!(
                    config.storage.storages.get(new_storage_id),
                    format!(
                        "Storage name: '{}' is missing in the config file",
                        new_storage_id
                    )
                );

                // check if the user has access to the storage and their limits wouldn't be exceeded if the file was moved
                let user = some_or_bail!(
                    db.get_user_by_id(requesting_user_id).await?,
                    "User not found"
                );
                let user_storage_limits = match &user.limits.get(new_storage_id) {
                    Some(Some(ul)) => ul,
                    _ => bail!(
                        "Storage name: '{}' is missing specifications on the user entry",
                        new_storage_id
                    ),
                };
                if user_storage_limits.max_files <= user_storage_limits.used_files {
                    bail!("User has reached the maximum number of files for this storage")
                }
                if user_storage_limits.max_storage
                    <= user_storage_limits.used_storage + filez_file.size
                {
                    bail!("User has reached the maximum size for this storage")
                }

                // move the file
                let new_storage_location = get_future_storage_location(
                    &config.storage,
                    &filez_file.file_id,
                    Some(new_storage_id),
                )?;

                let old_storage_location =
                    get_storage_location_from_file(&config.storage, &filez_file)?;

                fs::create_dir_all(&new_storage_location.folder_path).await?;

                fs::copy(
                    &old_storage_location.full_path,
                    &new_storage_location.full_path,
                )
                .await?;

                match db
                    .update_file_storage_id(&filez_file, new_storage_id, &user)
                    .await
                {
                    Ok(_) => {
                        fs::remove_file(&old_storage_location.full_path).await?;
                        return Ok(res.status(200).body(Body::from("Updated")).unwrap());
                    }
                    Err(e) => {
                        fs::remove_file(&new_storage_location.full_path).await?;
                        bail!("Failed to update storage id: {e}")
                    }
                };
            }
        }
    };

    if let Some(permission_ids) = ufir.fields.permission_ids {
        let requesting_user = match &auth.authenticated_ir_user_id {
            Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
                Some(u) => u,
                None => bail!("User has not been created on the filez server, although it is present on the IR server. Run create_own first."),
            },
            None =>  return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap()),
        };

        if requesting_user.user_id != filez_file.owner_id {
            return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
        }
        // check if all permissions are owned by the requesting user
        let permissions = db.get_permissions_by_resource_ids(&permission_ids).await?;
        for permission in permissions {
            if permission.owner_id != requesting_user.user_id {
                return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
            }
        }

        db.update_file_permission_ids(&filez_file.file_id, &permission_ids)
            .await?;
    }

    Ok(res.status(201).body(Body::from("Ok")).unwrap())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequest {
    pub file_id: String,
    pub fields: UpdateFileInfosRequestField,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequestField {
    #[ts(optional)]
    pub mime_type: Option<String>,
    #[ts(optional)]
    pub name: Option<String>,
    #[ts(optional)]
    pub static_file_group_ids: Option<Vec<String>>,
    #[ts(optional)]
    pub keywords: Option<Vec<String>>,
    #[ts(optional)]
    pub owner_id: Option<String>,
    #[ts(optional)]
    pub storage_id: Option<String>,
    #[ts(optional)]
    pub permission_ids: Option<Vec<String>>,
}
