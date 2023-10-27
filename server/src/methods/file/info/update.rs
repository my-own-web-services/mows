use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    permissions::{check_auth, AuthResourceToCheck, FilezFilePermissionAclWhatOptions},
    some_or_bail,
    utils::{
        check_file_name, check_keywords, check_mime_type, check_owner_id, check_static_file_groups,
        check_storage_id, get_folder_and_file_path,
    },
};
use anyhow::bail;
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
    let body = hyper::body::to_bytes(req.into_body()).await?;
    let ufir: UpdateFileInfosRequest = serde_json::from_slice(&body)?;

    let filez_file = match db.get_file_by_id(&ufir.file_id).await {
        Ok(file) => some_or_bail!(file, "File not found"),
        Err(_) => bail!("File not found"),
    };

    match ufir.field {
        UpdateFileInfosRequestField::MimeType(new_mime_type) => {
            check_mime_type(&new_mime_type)?;

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
            db.update_mime_type(&filez_file.file_id, &new_mime_type)
                .await?;

            Ok(res.status(200).body(Body::from("Updated")).unwrap())
        }
        UpdateFileInfosRequestField::Name(new_name) => {
            check_file_name(&new_name)?;

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
            db.update_file_name(&filez_file.file_id, &new_name).await?;

            Ok(res.status(200).body(Body::from("Updated")).unwrap())
        }

        UpdateFileInfosRequestField::StaticFileGroupIds(new_static_file_group_ids) => {
            check_static_file_groups(&new_static_file_group_ids)?;
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
            db.check_file_group_existence(&new_static_file_group_ids)
                .await?;

            db.update_static_file_group_ids(&filez_file.file_id, &new_static_file_group_ids)
                .await?;

            Ok(res.status(200).body(Body::from("Updated")).unwrap())
        }
        UpdateFileInfosRequestField::Keywords(new_keywords) => {
            check_keywords(&new_keywords)?;

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
                .into_iter()
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
            db.update_keywords(&filez_file.file_id, &new_keywords)
                .await?;

            Ok(res.status(200).body(Body::from("Updated")).unwrap())
        }
        UpdateFileInfosRequestField::OwnerId(new_owner_id) => {
            // check if the file is owned by the user
            if let Some(requesting_user_id) = &auth.authenticated_ir_user_id {
                if requesting_user_id == &filez_file.owner_id {
                    // mark the file as in transfer
                    // the new owner has to accept the transfer
                    check_owner_id(&new_owner_id)?;

                    if db.get_user_by_id(&new_owner_id).await?.is_none() {
                        bail!("New owner does not exist")
                    }

                    db.update_pending_new_owner_id(&filez_file.file_id, &new_owner_id)
                        .await?;
                    return Ok(res.status(200).body(Body::from("Updated")).unwrap());
                }
            }

            Ok(res.status(401).body(Body::from("Unauthorized")).unwrap())
        }
        UpdateFileInfosRequestField::StorageId(new_storage_id) => {
            // check if user is the owner
            if let Some(requesting_user_id) = &auth.authenticated_ir_user_id {
                if requesting_user_id == &filez_file.owner_id {
                    // check if storage id is valid
                    check_storage_id(&new_storage_id)?;

                    if filez_file.readonly {
                        bail!("File is readonly")
                    }

                    if filez_file.storage_id.is_some() {
                        if filez_file.storage_id.as_ref().unwrap() == &new_storage_id {
                            bail!("File is already stored on the storage")
                        }
                    } else {
                        bail!("File is not stored on a storage with a storage id")
                    }

                    // check if storage path exists
                    let new_storage_path = some_or_bail!(
                        config.storage.get(&new_storage_id),
                        format!(
                            "Storage name: '{}' is missing in the config file",
                            new_storage_id
                        )
                    )
                    .path
                    .clone();

                    // check if the user has access to the storage and their limits wouldn't be exceeded if the file was moved
                    let user = some_or_bail!(
                        db.get_user_by_id(requesting_user_id).await?,
                        "User not found"
                    );
                    let user_storage_limits = some_or_bail!(
                        user.limits.get(&new_storage_id),
                        "User does not have access to the storage"
                    );
                    if user_storage_limits.max_files <= user_storage_limits.used_files {
                        bail!("User has reached the maximum number of files for this storage")
                    }
                    if user_storage_limits.max_storage
                        <= user_storage_limits.used_storage + filez_file.size
                    {
                        bail!("User has reached the maximum size for this storage")
                    }

                    // move the file
                    let (new_folder_path, new_file_name) =
                        get_folder_and_file_path(&filez_file.file_id, &new_storage_path);

                    fs::create_dir_all(&new_folder_path).await?;
                    let new_file_path = format!("{}/{}", new_folder_path, new_file_name);

                    fs::copy(&filez_file.path, &new_file_path).await?;

                    match db
                        .update_storage_id(&filez_file, &new_storage_id, &new_file_path, &user)
                        .await
                    {
                        Ok(_) => {
                            fs::remove_file(&filez_file.path).await?;
                            return Ok(res.status(200).body(Body::from("Updated")).unwrap());
                        }
                        Err(e) => {
                            fs::remove_file(&new_file_path).await?;
                            bail!("Failed to update storage id: {e}")
                        }
                    };
                }
            }
            Ok(res.status(401).body(Body::from("Unauthorized")).unwrap())
        }
    }
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequest {
    pub file_id: String,
    pub field: UpdateFileInfosRequestField,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UpdateFileInfosRequestField {
    MimeType(String),
    Name(String),
    OwnerId(String),
    StorageId(String),
    StaticFileGroupIds(Vec<String>),
    Keywords(Vec<String>),
}
