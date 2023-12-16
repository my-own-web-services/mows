use std::collections::HashMap;

use crate::{
    config::SERVER_CONFIG,
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    is_transient_transaction_error,
    permissions::{check_auth_multiple, CommonAclWhatOptions, FilezFilePermissionAclWhatOptions},
    retry_transient_transaction_error, some_or_bail,
    utils::{
        check_file_name, check_keywords, check_mime_type, check_owner_id, check_static_file_groups,
        check_storage_id, fix_hierarchic_keywords,
    },
};
use anyhow::bail;
use filez_common::{
    server::{FileGroupType, FilezFile, PermissiveResource},
    storage::index::{get_future_storage_location, get_storage_location_from_file},
};
use hyper::{Body, Request, Response};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use simple_server_timing_header::Timer;
use tokio::fs;
use ts_rs::TS;
/**
# Updates the infos of given files.

## Atomicity
Yes, for all but the storageId update.

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
    timer.add("10 Get Authenticated User");

    let body = hyper::body::to_bytes(req.into_body()).await?;
    let ufir: UpdateFileInfosRequestBody = serde_json::from_slice(&body)?;

    // check phase
    let (updated_file_ids, changed_field): (Vec<String>, String) = match ufir.data {
        UpdateFileInfosRequestField::MimeType(fstu) => {
            for ftu in fstu.iter() {
                check_mime_type(&ftu.field)?;
            }
            crate::check_auth_multiple!(
                db,
                auth,
                res,
                fstu,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosMimeType
            );

            // sort the files in the distinct mime types they are going to be moved to
            let mut file_ids_by_mime_type: HashMap<String, Vec<String>> = HashMap::new();

            for ftu in fstu.iter() {
                let new_mime_type = ftu.field.clone();
                // add the mime type to the hashmap if it doesn't exist yet
                if !file_ids_by_mime_type.contains_key(&new_mime_type) {
                    file_ids_by_mime_type.insert(new_mime_type.clone(), Vec::new());
                }
                // add the file to the hashmap
                file_ids_by_mime_type
                    .get_mut(&new_mime_type)
                    .unwrap()
                    .push(ftu.file_id.clone());
            }

            retry_transient_transaction_error!(
                db.update_files_mime_types(&file_ids_by_mime_type).await
            );
            (
                fstu.iter().map(|f| f.file_id.clone()).collect(),
                "mime_type".to_string(),
            )
        }
        UpdateFileInfosRequestField::Name(fstu) => {
            for ftu in fstu.iter() {
                check_file_name(&ftu.field)?;
            }
            crate::check_auth_multiple!(
                db,
                auth,
                res,
                fstu,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosName
            );

            // sort the files in the distinct names they are going to be moved to
            let mut file_ids_by_name: HashMap<String, Vec<String>> = HashMap::new();

            for ftu in fstu.iter() {
                let new_name = ftu.field.clone();
                // add the name to the hashmap if it doesn't exist yet
                if !file_ids_by_name.contains_key(&new_name) {
                    file_ids_by_name.insert(new_name.clone(), Vec::new());
                }
                // add the file to the hashmap
                file_ids_by_name
                    .get_mut(&new_name)
                    .unwrap()
                    .push(ftu.file_id.clone());
            }

            retry_transient_transaction_error!(db.update_files_names(&file_ids_by_name).await);
            (
                fstu.iter().map(|f| f.file_id.clone()).collect(),
                "name".to_string(),
            )
        }
        UpdateFileInfosRequestField::StaticFileGroupsIds(fstu) => {
            for ftu in fstu.iter() {
                check_static_file_groups(&ftu.field)?;
            }

            let all_static_fgi = fstu.iter().flat_map(|f| f.field.clone()).unique().collect();

            db.check_file_group_existence(&all_static_fgi).await?;

            let files = crate::check_auth_multiple!(
                db,
                auth,
                res,
                fstu,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosStaticFileGroups
            );

            // basically the same as the keywords update

            let mut file_ids_by_single_static_file_groups_to_be_added: HashMap<
                String,
                Vec<String>,
            > = HashMap::new();
            let mut file_ids_by_single_static_file_groups_to_be_removed: HashMap<
                String,
                Vec<String>,
            > = HashMap::new();
            for ftu in fstu.iter() {
                let filez_file = some_or_bail!(
                    files.iter().find(|f| f.file_id == ftu.file_id),
                    "Could not find file in db"
                );
                // get the added and removed static file groups
                let added_static_file_groups = ftu
                    .field
                    .iter()
                    .filter(|k| !filez_file.static_file_group_ids.contains(k))
                    .collect::<Vec<&String>>();

                let removed_static_file_groups = filez_file
                    .static_file_group_ids
                    .iter()
                    .filter(|k| !ftu.field.contains(k))
                    .collect::<Vec<&String>>();

                // add the static file groups to the hashmap if they don't exist yet
                for static_file_group in added_static_file_groups.iter() {
                    if !file_ids_by_single_static_file_groups_to_be_added
                        .contains_key(*static_file_group)
                    {
                        file_ids_by_single_static_file_groups_to_be_added
                            .insert((*static_file_group).clone(), Vec::new());
                    }
                }

                for static_file_group in removed_static_file_groups.iter() {
                    if !file_ids_by_single_static_file_groups_to_be_removed
                        .contains_key(*static_file_group)
                    {
                        file_ids_by_single_static_file_groups_to_be_removed
                            .insert((*static_file_group).clone(), Vec::new());
                    }
                }

                // add the file to the hashmap
                for static_file_group in added_static_file_groups.iter() {
                    file_ids_by_single_static_file_groups_to_be_added
                        .get_mut(*static_file_group)
                        .unwrap()
                        .push(ftu.file_id.clone());
                }

                for static_file_group in removed_static_file_groups.iter() {
                    file_ids_by_single_static_file_groups_to_be_removed
                        .get_mut(*static_file_group)
                        .unwrap()
                        .push(ftu.file_id.clone());
                }
            }

            retry_transient_transaction_error!(
                db.update_files_and_file_groups(
                    &file_ids_by_single_static_file_groups_to_be_added,
                    &file_ids_by_single_static_file_groups_to_be_removed,
                    FileGroupType::Static
                )
                .await
            );

            (
                fstu.iter().map(|f| f.file_id.clone()).collect(),
                "static_file_group_ids".to_string(),
            )
        }
        UpdateFileInfosRequestField::Keywords(fstu) => {
            for ftu in fstu.iter() {
                check_keywords(&ftu.field)?;
            }
            let files = crate::check_auth_multiple!(
                db,
                auth,
                res,
                fstu,
                FilezFilePermissionAclWhatOptions::UpdateFileInfosKeywords
            );

            let mut file_ids_by_single_keywords_to_be_added: HashMap<String, Vec<String>> =
                HashMap::new();
            let mut file_ids_by_single_keywords_to_be_removed: HashMap<String, Vec<String>> =
                HashMap::new();
            for ftu in fstu.iter() {
                let keywords_to_be_set = fix_hierarchic_keywords(ftu.field.clone());
                let filez_file = some_or_bail!(
                    files.iter().find(|f| f.file_id == ftu.file_id),
                    "Could not find file in db"
                );
                // get the added and removed keywords
                let added_keywords = keywords_to_be_set
                    .iter()
                    .filter(|k| !filez_file.keywords.contains(k))
                    .collect::<Vec<&String>>();
                let removed_keywords = filez_file
                    .keywords
                    .iter()
                    .filter(|k| !keywords_to_be_set.contains(k))
                    .collect::<Vec<&String>>();

                // add the keywords to the hashmap if they don't exist yet
                for keyword in added_keywords.iter() {
                    if !file_ids_by_single_keywords_to_be_added.contains_key(*keyword) {
                        file_ids_by_single_keywords_to_be_added
                            .insert((*keyword).clone(), Vec::new());
                    }
                }

                for keyword in removed_keywords.iter() {
                    if !file_ids_by_single_keywords_to_be_removed.contains_key(*keyword) {
                        file_ids_by_single_keywords_to_be_removed
                            .insert((*keyword).clone(), Vec::new());
                    }
                }

                // add the file to the hashmap
                for keyword in added_keywords.iter() {
                    file_ids_by_single_keywords_to_be_added
                        .get_mut(*keyword)
                        .unwrap()
                        .push(ftu.file_id.clone());
                }

                for keyword in removed_keywords.iter() {
                    file_ids_by_single_keywords_to_be_removed
                        .get_mut(*keyword)
                        .unwrap()
                        .push(ftu.file_id.clone());
                }
            }

            retry_transient_transaction_error!(
                db.update_file_keywords(
                    &file_ids_by_single_keywords_to_be_added,
                    &file_ids_by_single_keywords_to_be_removed
                )
                .await
            );

            (
                fstu.iter().map(|f| f.file_id.clone()).collect(),
                "keywords".to_string(),
            )
        }
        UpdateFileInfosRequestField::OwnerId(fstu) => {
            for ftu in fstu.iter() {
                check_owner_id(&ftu.field)?;
            }

            let all_owner_ids = fstu.iter().map(|f| f.field.clone()).unique().collect();

            db.check_users_exist(&all_owner_ids).await?;

            let file_ids = fstu
                .iter()
                .map(|f| f.file_id.clone())
                .collect::<Vec<String>>();
            let files = db.get_files_by_ids(&file_ids).await?;

            let all_owned_by_requestor = files.iter().all(|f| f.file_id == requesting_user.user_id);
            if !all_owned_by_requestor {
                return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
            }

            // group the files by the new owner id
            let mut files_by_owner_id: HashMap<String, Vec<String>> = HashMap::new();

            for ftu in fstu.iter() {
                let new_owner_id = ftu.field.clone();
                // add the owner id to the hashmap if it doesn't exist yet
                if !files_by_owner_id.contains_key(&new_owner_id) {
                    files_by_owner_id.insert(new_owner_id.clone(), Vec::new());
                }
                // add the file to the hashmap
                files_by_owner_id
                    .get_mut(&new_owner_id)
                    .unwrap()
                    .push(ftu.file_id.clone());
            }

            retry_transient_transaction_error!(
                db.update_files_pending_owner(&files_by_owner_id).await
            );
            (
                fstu.iter().map(|f| f.file_id.clone()).collect(),
                "owner_id".to_string(),
            )
        }
        UpdateFileInfosRequestField::StorageId(fstu) => {
            for ftu in fstu.iter() {
                check_storage_id(&ftu.field)?;
            }

            let file_ids = fstu
                .iter()
                .map(|f| f.file_id.clone())
                .collect::<Vec<String>>();
            let files = db.get_files_by_ids(&file_ids).await?;

            let mut files_by_storage_id: HashMap<String, Vec<FilezFile>> = HashMap::new();

            // check if all files have a different storage id than the new one
            for file in files.iter() {
                if requesting_user.user_id != file.owner_id {
                    return Ok(res.status(401).body(Body::from("Unauthorized")).unwrap());
                }
                if file.readonly {
                    bail!("One of the files to update is readonly")
                }

                // find by file id
                let new_storage_id = &some_or_bail!(
                    fstu.iter().find(|f| f.file_id == file.file_id),
                    "File not found in array"
                )
                .field;

                if file.storage_id == Some(new_storage_id.to_string()) {
                    bail!("One of the files to update already has the new storage id")
                }

                some_or_bail!(
                    config.storage.storages.get(&new_storage_id.to_string()),
                    format!(
                        "Storage name: '{}' is missing in the config file",
                        new_storage_id
                    )
                );

                // add the storage id to the hashmap if it doesn't exist yet
                if !files_by_storage_id.contains_key(&new_storage_id.to_string()) {
                    files_by_storage_id.insert(new_storage_id.clone(), Vec::new());
                }
                // add the file to the hashmap
                files_by_storage_id
                    .get_mut(&new_storage_id.to_string())
                    .unwrap()
                    .push(file.clone());
            }
            // sort the files in the distinct storage ids they are going to be moved to

            // check if the user has access to the storage and their limits wouldn't be exceeded if the files were moved
            for (new_storage_id, files_per_storage_id) in files_by_storage_id.iter() {
                let user_storage_limits = match &requesting_user.limits.get(new_storage_id) {
                    Some(Some(ul)) => ul,
                    _ => bail!(
                        "Storage name: '{}' is missing specifications on the user entry",
                        new_storage_id
                    ),
                };
                if user_storage_limits.max_files
                    <= user_storage_limits.used_files + files_per_storage_id.len() as u64
                {
                    bail!("User has reached the maximum number of files for this storage")
                }
                if user_storage_limits.max_storage
                    <= user_storage_limits.used_storage
                        + files_per_storage_id.iter().map(|f| f.size).sum::<u64>()
                {
                    bail!("User has reached the maximum size for this storage")
                }

                for filez_file in files_per_storage_id {
                    // move the file
                    let new_storage_location = get_future_storage_location(
                        &config.storage,
                        &filez_file.file_id,
                        Some(new_storage_id),
                    )?;

                    let old_storage_location =
                        get_storage_location_from_file(&config.storage, filez_file)?;

                    fs::create_dir_all(&new_storage_location.folder_path).await?;

                    // TODO move app data too

                    if fs::copy(
                        &old_storage_location.full_path,
                        &new_storage_location.full_path,
                    )
                    .await
                    .is_err()
                    {
                        bail!("Failed to move file")
                    };

                    while let Err(e) = db
                        .update_file_storage_id(filez_file, new_storage_id, &requesting_user)
                        .await
                    {
                        if is_transient_transaction_error!(e) {
                            continue;
                        } else {
                            if let Err(e) = fs::remove_file(&new_storage_location.full_path).await {
                                println!("FATAL ERROR: Failed to remove new file after database update failed: {}", e);
                            };

                            bail!("Failed to update storage id: {e}")
                        }
                    }
                    if let Err(e) = fs::remove_file(&old_storage_location.full_path).await {
                        println!("FATAL ERROR: Failed to remove old file after database insertion success: {}", e);
                    };
                }
            }
            (
                fstu.iter().map(|f| f.file_id.clone()).collect(),
                "storage_id".to_string(),
            )
        }
    };

    timer.add("20 Update Files");

    let updated_files = db.get_files_by_ids(&updated_file_ids).await?;
    handle_dynamic_group_update(
        db,
        &UpdateType::Files((updated_files, Some(changed_field))),
        &requesting_user.user_id,
    )
    .await?;

    timer.add("30 Update Dynamic Groups");

    Ok(res
        .status(200)
        .header("Server-Timing", timer.header_value())
        .body(Body::from("Ok"))
        .unwrap())
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequestBody {
    pub data: UpdateFileInfosRequestField,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UpdateFileInfosRequestField {
    MimeType(Vec<UpdateFileInfosRequestBodySingle<String>>),
    Name(Vec<UpdateFileInfosRequestBodySingle<String>>),
    StaticFileGroupsIds(Vec<UpdateFileInfosRequestBodySingle<Vec<String>>>),
    Keywords(Vec<UpdateFileInfosRequestBodySingle<Vec<String>>>),
    OwnerId(Vec<UpdateFileInfosRequestBodySingle<String>>),
    StorageId(Vec<UpdateFileInfosRequestBodySingle<String>>),
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UpdateFileInfosRequestBodySingle<T> {
    pub file_id: String,
    pub field: T,
}

#[macro_export]
macro_rules! check_auth_multiple {
    ($db:expr, $auth:expr, $res:expr, $files_to_update:expr, $acl_what_options:expr) => {{
        let file_ids = $files_to_update
            .iter()
            .map(|f| f.file_id.clone())
            .collect::<Vec<String>>();

        let files = $db.get_files_by_ids(&file_ids).await?;
        let files_auth = files
            .clone()
            .iter()
            .map(|file| Box::new((*file).clone()) as Box<dyn PermissiveResource>)
            .collect();
        match check_auth_multiple(
            $auth,
            &files_auth,
            &CommonAclWhatOptions::File($acl_what_options),
            $db,
        )
        .await
        {
            Ok(true) => {}
            Ok(false) => {
                return Ok($res.status(401).body(Body::from("Unauthorized")).unwrap());
            }
            Err(e) => bail!(e),
        }
        files
    }};
}
