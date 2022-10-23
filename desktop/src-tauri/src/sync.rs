use std::{cmp::Ordering, collections::HashMap, fs::DirEntry, path::Path, vec};

use crate::{
    api_types::FilezFile,
    methods::{
        create_file::create_file, delete_file::delete_file, get_file::get_file,
        get_file_infos_by_group_id::get_file_infos_by_group_id, update_file::update_file,
    },
    some_or_bail,
    types::{FilezClientAppDataFile, FilezClientConfig, IntermediaryFile, SyncOperation, SyncType},
    utils::{generate_id, get_created_time_secs, get_modified_time_secs, recursive_read_dir},
};
use anyhow::bail;

pub async fn run_sync(
    server_url: &str,
    local_folder: &str,
    remote_volume: &str,
    sync_method: &str,
    user_id: &str,
    local_config_dir: &str,
) -> anyhow::Result<(Vec<String>, Vec<String>, Vec<String>)> {
    println!(
        "Syncing {} to {} on {} with sync method {}",
        local_folder, remote_volume, server_url, sync_method
    );

    // stick together the sync id
    let sync_id = format!("{}-{}-{}", local_folder, sync_method, remote_volume).replace('/', "-");

    // check if a sync operation with this id is already registered on the user
    // if not, append the sync job to the user
    let mut client_info: FilezClientConfig = match get_client_info(local_config_dir).await {
        Ok(client_info) => client_info,
        Err(e) => {
            dbg!(e);
            match create_or_update_client_info(local_config_dir, None).await {
                Ok(client_info) => client_info,
                Err(e) => return Err(e),
            }
        }
    };
    //dbg!(&client_info);

    let sync_operation = match client_info.sync_operations.get(&sync_id) {
        Some(sync_operation) => sync_operation.clone(),
        None => {
            // create a new sync operation
            let group_id = generate_id();
            let sync_operation = SyncOperation {
                local_folder: local_folder.to_string(),
                remote_volume: remote_volume.to_string(),
                last_sync: None,
                interval: 0,
                group_id,
                sync_type: match sync_method {
                    "push" => SyncType::Push,
                    "pushDelete" => SyncType::PushDelete,
                    "pull" => SyncType::Pull,
                    "pullDelete" => SyncType::PullDelete,
                    "merge" => SyncType::Merge,
                    _ => bail!("Invalid sync method"),
                },
            };

            client_info
                .sync_operations
                .insert(sync_id.clone(), sync_operation.clone());

            create_or_update_client_info(local_config_dir, Some(&client_info)).await?;

            sync_operation
        }
    };

    tokio::fs::create_dir_all(sync_operation.local_folder.to_string()).await?;

    // execute the sync job
    match exec_sync_operation(server_url, sync_operation, local_config_dir, &sync_id).await {
        Ok(success_with_errors) => Ok(success_with_errors),
        Err(e) => Err(e),
    }
}

pub async fn exec_sync_operation(
    address: &str,
    sync_operation: SyncOperation,
    local_config_dir: &str,
    sync_id: &str,
) -> anyhow::Result<(Vec<String>, Vec<String>, Vec<String>)> {
    let local_file_results: Vec<anyhow::Result<IntermediaryFile>> =
        match recursive_read_dir(&sync_operation.local_folder) {
            Ok(files) => files
                .iter()
                .map(|f| dir_entry_to_intermediary_file(f, &sync_operation.local_folder))
                .collect(),
            Err(e) => bail!("Failed to read local folder: {}", e),
        };

    let mut local_read_errors: Vec<String> = vec![];
    let mut local_files: Vec<IntermediaryFile> = vec![];
    for local_file in local_file_results {
        match local_file {
            Ok(local_file) => local_files.push(local_file),
            Err(e) => local_read_errors.push(e.to_string()),
        }
    }

    let remote_files_results: Vec<anyhow::Result<IntermediaryFile>> =
        get_file_infos_by_group_id(address, &sync_operation.group_id)
            .await?
            .iter()
            .map(filez_file_to_intermediary_file)
            .collect();

    let mut remote_file_errors: Vec<String> = vec![];
    let mut remote_files: Vec<IntermediaryFile> = vec![];
    for remote_file in remote_files_results {
        match remote_file {
            Ok(remote_file) => remote_files.push(remote_file),
            Err(e) => remote_file_errors.push(e.to_string()),
        }
    }

    dbg!(&remote_files);
    dbg!(&local_files);

    // perform the sync based on comparison and method
    if sync_operation.sync_type == SyncType::Merge {
        // merge local and remote files
        match run_merge(
            address,
            sync_operation,
            local_files,
            remote_files,
            local_config_dir,
            sync_id,
        )
        .await
        {
            Ok(delete_errors) => Ok((local_read_errors, remote_file_errors, delete_errors)),
            Err(e) => Err(e),
        }
    } else if sync_operation.sync_type == SyncType::Push
        || sync_operation.sync_type == SyncType::PushDelete
    {
        // push files to remote
        match run_push(address, sync_operation, local_files, remote_files).await {
            Ok(delete_errors) => Ok((local_read_errors, remote_file_errors, delete_errors)),
            Err(e) => bail!(e),
        }
    } else {
        // pull files from remote
        match run_pull(address, sync_operation, local_files, remote_files).await {
            Ok(delete_errors) => Ok((local_read_errors, remote_file_errors, delete_errors)),
            Err(e) => bail!(e),
        }
    }
}

pub async fn run_merge(
    address: &str,
    sync_operation: SyncOperation,
    local_files: Vec<IntermediaryFile>,
    remote_files: Vec<IntermediaryFile>,
    local_config_dir: &str,
    sync_id: &str,
) -> anyhow::Result<Vec<String>> {
    let mut delete_errors: Vec<String> = vec![];
    // DELETE
    // create file list of remote files
    // if file list does not exist we dont perform the delete operation on the first sync
    if let Ok(last_sync_lists) = get_last_sync_lists(local_config_dir, sync_id).await {
        // delete files remote that have been deleted locally since last sync
        let mut local_files_to_delete_remote: Vec<IntermediaryFile> = vec![];
        for local_file in &local_files {
            if !last_sync_lists.0.contains(&local_file.client_id) {
                local_files_to_delete_remote.push(local_file.clone());
            }
        }

        for local_file in local_files_to_delete_remote {
            match delete_file(
                address,
                some_or_bail!(
                    &local_file.existing_id,
                    "Local file has not existing id on server so it cannot be deleted"
                ),
            )
            .await
            {
                Ok(_) => (),
                Err(e) => delete_errors.push(e.to_string()),
            }
        }

        // delete files local that have been deleted remote since last sync
        let mut remote_files_to_delete_local: Vec<IntermediaryFile> = vec![];
        for remote_file in &remote_files {
            if !last_sync_lists.1.contains(&remote_file.client_id) {
                remote_files_to_delete_local.push(remote_file.clone());
            }
        }

        for remote_file in remote_files_to_delete_local {
            match tokio::fs::remove_file(some_or_bail!(
                &remote_file.path,
                "Remote file has no path"
            ))
            .await
            {
                Ok(_) => {}
                Err(e) => {
                    delete_errors.push(format!(
                        "Failed to delete file {:?}: {}",
                        remote_file.path, e
                    ));
                }
            }
        }
    };

    // UPDATE
    // update changed files in one or the other direction based on their modified time
    {
        // run comparison of local and remote files
        let mut comp_results: Vec<MergeCompareResult> = vec![];
        for remote_file in &remote_files {
            let mut comp_result = MergeCompareResult::DifferentId;
            for local_file in &local_files {
                match compare_local_and_remote_files_merge(local_file, remote_file) {
                    MergeCompareResult::EqualIdSameContent => {
                        comp_result = MergeCompareResult::EqualIdSameContent;
                        break;
                    }
                    MergeCompareResult::EqualIdUpdateLocal => {
                        comp_result = MergeCompareResult::EqualIdUpdateLocal;
                        break;
                    }
                    MergeCompareResult::EqualIdUpdateRemote => {
                        comp_result = MergeCompareResult::EqualIdUpdateRemote;
                        break;
                    }
                    MergeCompareResult::DifferentId => {}
                }
            }
            comp_results.push(comp_result);
        }
        // update files
        for (i, comp_result) in comp_results.iter().enumerate() {
            match comp_result {
                MergeCompareResult::EqualIdSameContent => (),
                MergeCompareResult::EqualIdUpdateLocal => {
                    let remote_file = &remote_files[i];
                    match get_file(
                        address,
                        some_or_bail!(&remote_file.existing_id, "Remote file has no existing id"),
                        remote_file.path.clone(),
                        &sync_operation.local_folder,
                    )
                    .await
                    {
                        Ok(_) => (),
                        Err(_) => todo!(),
                    }
                }
                MergeCompareResult::EqualIdUpdateRemote => {
                    let remote_file = &remote_files[i];
                    let local_file = some_or_bail!(
                        local_files
                            .iter()
                            .find(|f| f.client_id == remote_file.client_id),
                        "This should not happen: local file not found"
                    );
                    match update_file(
                        address,
                        local_file,
                        some_or_bail!(&remote_file.existing_id, "Remote file has no existing id"),
                    )
                    .await
                    {
                        Ok(_) => (),
                        Err(_) => todo!(),
                    }
                }
                MergeCompareResult::DifferentId => (),
            }
        }
    }

    // CREATE
    // download/upload new files
    {
        let mut local_files_to_upload: Vec<IntermediaryFile> = vec![];
        let mut remote_files_to_download: Vec<IntermediaryFile> = vec![];
        for remote_file in &remote_files {
            let mut found = false;
            for local_file in &local_files {
                if local_file.client_id == remote_file.client_id {
                    found = true;
                    break;
                }
            }
            if !found {
                remote_files_to_download.push(remote_file.clone());
            }
        }
        //dbg!(&remote_files);
        //dbg!(&local_files);
        for local_file in &local_files {
            let mut found = false;
            for remote_file in &remote_files {
                if local_file.client_id == remote_file.client_id {
                    found = true;
                    break;
                }
            }
            if !found {
                local_files_to_upload.push(local_file.clone());
            }
        }

        //dbg!(&local_files_to_upload);
        //dbg!(&remote_files_to_download);
        // upload new local files
        for local_file in local_files_to_upload {
            match create_file(address, &local_file, &sync_operation.group_id).await {
                Ok(_) => (),
                Err(_) => todo!(),
            }
        }
        // download new remote files
        for remote_file in remote_files_to_download {
            match get_file(
                address,
                some_or_bail!(
                    &remote_file.existing_id,
                    "Remote file has no existing id: this should not happen"
                ),
                remote_file.path,
                &sync_operation.local_folder,
            )
            .await
            {
                Ok(_) => (),
                Err(_) => todo!(),
            }
        }
    }

    // save the file lists for the next sync
    save_current_sync_lists(local_config_dir, sync_id, &local_files, &remote_files).await?;

    Ok(delete_errors)
}

pub fn compare_local_and_remote_files_merge(
    local_file: &IntermediaryFile,
    remote_file: &IntermediaryFile,
) -> MergeCompareResult {
    if local_file.client_id == remote_file.client_id {
        match local_file.modified.cmp(&remote_file.modified) {
            Ordering::Less => MergeCompareResult::EqualIdUpdateLocal,
            Ordering::Equal => MergeCompareResult::EqualIdSameContent,
            Ordering::Greater => MergeCompareResult::EqualIdUpdateRemote,
        }
    } else {
        MergeCompareResult::DifferentId
    }
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub enum MergeCompareResult {
    EqualIdSameContent,
    EqualIdUpdateLocal,
    EqualIdUpdateRemote,
    DifferentId,
}

pub async fn save_current_sync_lists(
    local_config_dir: &str,
    sync_id: &str,
    local_files: &[IntermediaryFile],
    remote_files: &[IntermediaryFile],
) -> anyhow::Result<()> {
    let full_sync_list_path = Path::new(local_config_dir).join("filez").join("syncLists");
    tokio::fs::create_dir_all(full_sync_list_path.clone()).await?;

    let local_file_ids: Vec<String> = local_files.iter().map(|l| l.client_id.clone()).collect();
    let remote_file_ids: Vec<String> = remote_files.iter().map(|l| l.client_id.clone()).collect();

    let local_list_path = full_sync_list_path
        .clone()
        .join(format!("{}_local.json", sync_id));
    let remote_list_path = full_sync_list_path.join(format!("{}_remote.json", sync_id));

    let local_list_string = serde_json::to_string(&local_file_ids)?;
    let remote_list_string = serde_json::to_string(&remote_file_ids)?;

    tokio::fs::write(local_list_path, local_list_string).await?;
    tokio::fs::write(remote_list_path, remote_list_string).await?;

    Ok(())
}

pub async fn get_last_sync_lists(
    local_config_dir: &str,
    sync_id: &str,
) -> anyhow::Result<(Vec<String>, Vec<String>)> {
    let full_sync_list_path = Path::new(local_config_dir).join("filez").join("syncLists");

    let local_list_path = full_sync_list_path
        .clone()
        .join(format!("{}_local.json", sync_id));
    let local_list_string = match tokio::fs::read_to_string(local_list_path).await {
        Ok(local_list_string) => local_list_string,
        Err(e) => bail!("Failed to read local list file: {}", e),
    };

    let remote_list_path = full_sync_list_path.join(format!("{}_remote.json", sync_id));
    let remote_list_string = match tokio::fs::read_to_string(remote_list_path).await {
        Ok(remote_list_string) => remote_list_string,
        Err(e) => bail!("Failed to read remote list file: {}", e),
    };

    let remote_list: Vec<String> = serde_json::from_str(&remote_list_string)?;
    let local_list: Vec<String> = serde_json::from_str(&local_list_string)?;

    Ok((local_list, remote_list))
}

pub async fn run_pull(
    address: &str,
    sync_operation: SyncOperation,
    local_files: Vec<IntermediaryFile>,
    remote_files: Vec<IntermediaryFile>,
) -> anyhow::Result<Vec<String>> {
    let mut delete_errors: Vec<String> = vec![];

    let mut comp_results: Vec<LocalRemoteCompareResult> = vec![];
    for remote_file in &remote_files {
        let mut comp_result = LocalRemoteCompareResult::NotFound;
        for local_file in &local_files {
            match compare_local_and_remote_files_pp(local_file, remote_file) {
                LocalRemoteCompareResult::EqualId => {
                    comp_result = LocalRemoteCompareResult::EqualId;
                    break;
                }
                LocalRemoteCompareResult::EqualIdDifferentContent => {
                    comp_result = LocalRemoteCompareResult::EqualIdDifferentContent;
                    break;
                }
                LocalRemoteCompareResult::DifferentId => continue,
                LocalRemoteCompareResult::NotFound => continue,
            }
        }
        comp_results.push(comp_result);
    }

    let mut files_to_delete: Vec<String> = vec![];
    for (i, comp) in comp_results.iter().enumerate() {
        let remote_file = &remote_files[i];
        if comp == &LocalRemoteCompareResult::EqualIdDifferentContent
            || comp == &LocalRemoteCompareResult::NotFound
        {
            let maybe_imf = remote_files
                .iter()
                .find(|f| f.client_id == remote_file.client_id);

            match maybe_imf {
                Some(imf) => match &imf.existing_id {
                    Some(existing_id) => match get_file(
                        address,
                        existing_id,
                        imf.path.clone(),
                        &sync_operation.local_folder,
                    )
                    .await
                    {
                        Ok(_) => files_to_delete.push(existing_id.to_string()),
                        Err(_) => continue,
                    },
                    None => continue,
                },
                None => continue,
            };
        }
    }

    if sync_operation.sync_type == SyncType::PullDelete {
        // delete files remotely that were successfully pulled

        for file_id in files_to_delete {
            match delete_file(address, &file_id).await {
                Ok(_) => (),
                Err(e) => delete_errors.push(e.to_string()),
            };
        }
    }
    Ok(delete_errors)
}

pub async fn run_push(
    address: &str,
    sync_operation: SyncOperation,
    local_files: Vec<IntermediaryFile>,
    remote_files: Vec<IntermediaryFile>,
) -> anyhow::Result<Vec<String>> {
    let mut delete_errors: Vec<String> = vec![];

    let mut comp_results: Vec<LocalRemoteCompareResult> = vec![];
    for local_file in &local_files {
        let mut comp_result = LocalRemoteCompareResult::NotFound;
        for remote_file in &remote_files {
            match compare_local_and_remote_files_pp(local_file, remote_file) {
                LocalRemoteCompareResult::EqualId => {
                    comp_result = LocalRemoteCompareResult::EqualId;
                    break;
                }
                LocalRemoteCompareResult::EqualIdDifferentContent => {
                    comp_result = LocalRemoteCompareResult::EqualIdDifferentContent;
                    break;
                }
                LocalRemoteCompareResult::DifferentId => continue,
                LocalRemoteCompareResult::NotFound => continue,
            }
        }
        comp_results.push(comp_result);
    }

    let mut files_to_delete: Vec<String> = vec![];
    for (i, comp) in comp_results.iter().enumerate() {
        let local_file = &local_files[i];
        match comp {
            LocalRemoteCompareResult::EqualId => continue,
            LocalRemoteCompareResult::EqualIdDifferentContent => {
                let file_id = remote_files
                    .iter()
                    .find(|f| f.client_id == local_file.client_id);

                match file_id {
                    Some(file_id) => match &file_id.existing_id {
                        Some(existing_id) => {
                            match update_file(address, local_file, existing_id).await {
                                Ok(_) => match &local_file.real_path {
                                    Some(real_path) => files_to_delete.push(real_path.to_string()),
                                    None => continue,
                                },
                                Err(_) => continue,
                            }
                        }
                        None => continue,
                    },
                    None => continue,
                };
            }
            LocalRemoteCompareResult::DifferentId => continue,
            LocalRemoteCompareResult::NotFound => {
                match create_file(address, local_file, &sync_operation.group_id).await {
                    Ok(_) => match &local_file.real_path {
                        Some(real_path) => files_to_delete.push(real_path.to_string()),
                        None => continue,
                    },
                    Err(_) => continue,
                };
            }
        }
    }

    if sync_operation.sync_type == SyncType::PushDelete {
        // delete files locally that were successfully pushed
        files_to_delete.iter().for_each(|file_path| {
            match std::fs::remove_file(file_path) {
                Ok(_) => (),
                Err(e) => delete_errors.push(e.to_string()),
            };
        });
    }
    Ok(delete_errors)
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub enum LocalRemoteCompareResult {
    EqualId,
    EqualIdDifferentContent,
    DifferentId,
    NotFound,
}

pub fn compare_local_and_remote_files_pp(
    local_file: &IntermediaryFile,
    remote_file: &IntermediaryFile,
) -> LocalRemoteCompareResult {
    if local_file.client_id == remote_file.client_id {
        if local_file.modified == remote_file.modified {
            return LocalRemoteCompareResult::EqualId;
        } else {
            return LocalRemoteCompareResult::EqualIdDifferentContent;
        }
    }
    LocalRemoteCompareResult::DifferentId
}

pub async fn create_or_update_client_info(
    local_config_dir: &str,
    client_info: Option<&FilezClientConfig>,
) -> anyhow::Result<FilezClientConfig> {
    let client_info = match client_info {
        Some(client_info) => client_info.clone(),
        None => FilezClientConfig {
            sync_operations: HashMap::new(),
        },
    };
    let path = Path::new(local_config_dir)
        .join("filez")
        .join("config.json");

    let contents = serde_json::to_string_pretty(&client_info)?;
    tokio::fs::write(path, contents).await?;
    Ok(client_info)
}

pub async fn get_client_info(local_config_dir: &str) -> anyhow::Result<FilezClientConfig> {
    let path = Path::new(local_config_dir)
        .join("filez")
        .join("config.json");
    let file_str = tokio::fs::read_to_string(path).await?;

    match serde_json::from_str::<FilezClientConfig>(&file_str) {
        Ok(client_info) => Ok(client_info),
        Err(e) => bail!("Could not parse client info: {}", e),
    }
}

pub fn dir_entry_to_intermediary_file(
    d: &DirEntry,
    local_folder: &str,
) -> anyhow::Result<IntermediaryFile> {
    let m = match d.metadata() {
        Ok(metadata) => metadata,
        Err(e) => bail!("Could not get metadata for file: {}", e),
    };

    let p = d.path();
    let name = some_or_bail!(p.file_name(), "Could not get file name")
        .to_string_lossy()
        .to_string();
    let real_path = some_or_bail!(p.to_str(), "Could not convert path to string").to_string();
    let path = real_path.replacen(local_folder, "", 1);

    Ok(IntermediaryFile {
        name,
        modified: get_modified_time_secs(&m),
        created: some_or_bail!(get_created_time_secs(&m), "Could not get created time"),
        size: m.len(),
        mime_type: mime_guess::from_path(&path)
            .first_or_octet_stream()
            .to_string(),
        path: Some(path.clone()),
        client_id: path,
        real_path: Some(real_path),
        existing_id: None,
    })
}

pub fn filez_file_to_intermediary_file(f: &FilezFile) -> anyhow::Result<IntermediaryFile> {
    let client_app_data = match &f.app_data {
        Some(app_data) => match app_data.get("filezClient") {
            Some(client_app_data_value) => {
                match serde_json::from_value::<FilezClientAppDataFile>(
                    client_app_data_value.clone(),
                ) {
                    Ok(client_app_data) => client_app_data,
                    Err(e) => bail!("Could not parse client app data: {}", e),
                }
            }
            None => bail!("Could not find client app data"),
        },
        None => bail!("Could not find app data"),
    };

    Ok(IntermediaryFile {
        name: f.name.clone(),
        modified: f.modified,
        created: f.created,
        size: f.size,
        mime_type: f.mime_type.clone(),
        path: client_app_data.path.clone(),
        client_id: some_or_bail!(client_app_data.path, "Could not get path to set as id"),
        real_path: None,
        existing_id: Some(f.id.clone()),
    })
}
