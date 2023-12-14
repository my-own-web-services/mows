use crate::{
    config::SERVER_CONFIG,
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    is_transient_transaction_error,
    permissions::{check_auth, AuthResourceToCheck, FilezFilePermissionAclWhatOptions},
    retry_transient_transaction_error, some_or_bail,
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
use simple_server_timing_header::Timer;
use tokio::fs;
use ts_rs::TS;
/**
# Updates the infos of given files.

## Atomicity
No, will be aborted as soon as one file fails to update.

## Call

`/api/file/info/update/`

## Permissions
File > UpdateFileInfosName
File > UpdateFileInfosMimeType
File > UpdateFileInfosStaticFileGroups
File > UpdateFileInfosKeywords

## Possible Mutations
Mutation > FilezFile
Mutation > FilezFileGroup
Mutation > FilezUser

## Multiple Resources
Yes

*/
pub async fn update_file_infos(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let mut timer = Timer::new();

    crate::check_content_type_json!(req, res);

    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);
    timer.add("10 get_authenticated_user");

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let ufir: UpdateFileInfosRequestBody = serde_json::from_slice(&body)?;

    for file_to_update in &ufir.files {
        let filez_file = match db.get_file_by_id(&file_to_update.file_id).await {
            Ok(file) => some_or_bail!(file, "File not found"),
            Err(_) => bail!("File not found"),
        };
        let fields = &file_to_update.fields;

        if let Some(new_mime_type) = &fields.mime_type {
            check_mime_type(new_mime_type)?;

            match check_auth(
                auth,
                &AuthResourceToCheck::File((
                    &filez_file,
                    FilezFilePermissionAclWhatOptions::UpdateFileInfosMimeType,
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
            retry_transient_transaction_error!(
                db.update_file_mime_type(&filez_file.file_id, new_mime_type)
                    .await
            );
        };

        if let Some(new_name) = &fields.name {
            check_file_name(new_name)?;

            match check_auth(
                auth,
                &AuthResourceToCheck::File((
                    &filez_file,
                    FilezFilePermissionAclWhatOptions::UpdateFileInfosName,
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
            retry_transient_transaction_error!(
                db.update_file_name(&filez_file.file_id, new_name).await
            );
        };

        if let Some(new_static_file_group_ids) = &fields.static_file_group_ids {
            check_static_file_groups(new_static_file_group_ids)?;
            match check_auth(
                auth,
                &AuthResourceToCheck::File((
                    &filez_file,
                    FilezFilePermissionAclWhatOptions::UpdateFileInfosStaticFileGroups,
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
            db.check_file_group_existence(new_static_file_group_ids)
                .await?;

            retry_transient_transaction_error!(
                db.update_files_static_file_group_ids(
                    &filez_file.file_id,
                    &filez_file.static_file_group_ids,
                    new_static_file_group_ids,
                )
                .await
            );
        };

        if let Some(new_keywords) = &fields.keywords {
            check_keywords(new_keywords)?;

            match check_auth(
                auth,
                &AuthResourceToCheck::File((
                    &filez_file,
                    FilezFilePermissionAclWhatOptions::UpdateFileInfosKeywords,
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
            timer.add("20 check_auth");

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
            retry_transient_transaction_error!(
                db.update_file_keywords(&filez_file.file_id, &new_keywords)
                    .await
            );
        };

        if let Some(new_owner_id) = &fields.owner_id {
            // check if the file is owned by the user
            if let Some(requesting_user_id) = &auth.authenticated_ir_user_id {
                if requesting_user_id == &filez_file.owner_id {
                    // mark the file as in transfer
                    // the new owner has to accept the transfer
                    check_owner_id(new_owner_id)?;

                    if db.get_user_by_id(new_owner_id).await?.is_none() {
                        bail!("New owner does not exist")
                    }

                    retry_transient_transaction_error!(
                        db.update_pending_new_owner_id(&filez_file.file_id, new_owner_id)
                            .await
                    );
                }
            }
        };

        if let Some(new_storage_id) = &fields.storage_id {
            if requesting_user.user_id == filez_file.owner_id {
                // check if storage id is valid
                check_storage_id(new_storage_id)?;

                // check if storage ids are the same
                if let Some(current_storage_id) = &filez_file.storage_id {
                    if current_storage_id == new_storage_id {
                        bail!("Storage ids are the same")
                    }
                }

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

                let user_storage_limits = match &requesting_user.limits.get(new_storage_id) {
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

                // TODO move app data too

                if let Err(e) = fs::copy(
                    &old_storage_location.full_path,
                    &new_storage_location.full_path,
                )
                .await
                {
                    println!("FATAL ERROR: Failed to move file: {}", e);
                    bail!("Failed to move file")
                };

                while let Err(e) = db
                    .update_file_storage_id(&filez_file, new_storage_id, &requesting_user)
                    .await
                {
                    if is_transient_transaction_error!(e) {
                        continue;
                    } else {
                        if let Err(e) = fs::remove_file(&new_storage_location.full_path).await {
                            println!("FATAL ERROR: Failed to remove new file: {}", e);
                        };

                        bail!("Failed to update storage id: {e}")
                    }
                }
                if let Err(e) = fs::remove_file(&old_storage_location.full_path).await {
                    println!("FATAL ERROR: Failed to remove old file: {}", e);
                };
            }
        };

        if let Some(permission_ids) = &fields.permission_ids {
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
            let permissions = db.get_permissions_by_resource_ids(permission_ids).await?;
            for permission in permissions {
                if permission.owner_id != requesting_user.user_id {
                    return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
                }
            }

            while let Err(e) = db
                .update_file_permission_ids(&filez_file.file_id, permission_ids)
                .await
            {
                if is_transient_transaction_error!(e) {
                    continue;
                } else {
                    bail!(e)
                }
            }
        }

        timer.add("30 update_file");
        //TODO OPTIMIZE handle the whole thing in one call, and make it atomic
        let updated_file = some_or_bail!(
            db.get_file_by_id(&filez_file.file_id).await?,
            "Could not find just updated file?!"
        );

        timer.add("40 write_updates_to_db");
        handle_dynamic_group_update(
            db,
            &UpdateType::Files(vec![updated_file]),
            &requesting_user.user_id,
        )
        .await?;
        timer.add("50 handle_dynamic_group_update");
    }

    Ok(res
        .status(200)
        .header("Server-Timing", timer.header_value())
        .body(Body::from("Ok"))
        .unwrap())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequestBody {
    pub files: Vec<UpdateFileInfosRequestBodySingle>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequestBodySingle {
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
