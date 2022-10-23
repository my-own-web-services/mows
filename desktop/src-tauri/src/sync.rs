use std::{collections::HashMap, fmt::format, fs::DirEntry, path::Path, vec};

use crate::{
    api_types::{AppDataType, FilezFile, SetAppDataRequest},
    methods::{
        create_file::create_file, delete_file::delete_file, get_file::get_file,
        get_file_infos_by_group_id::get_file_infos_by_group_id, get_user_info::get_user_info,
        set_app_data::set_app_data, update_file::update_file,
    },
    some_or_bail,
    types::{FilezClientAppDataFile, FilezClientConfig, IntermediaryFile, SyncOperation, SyncType},
    utils::{generate_id, get_created_time_secs, get_modified_time_secs, recursive_read_dir},
};
use anyhow::bail;
use tokio::fs::File;

pub async fn run_sync(
    server_url: &str,
    local_folder: &str,
    remote_volume: &str,
    sync_method: &str,
    client_name: &str,
    user_id: &str,
    local_config_dir: &str,
) -> anyhow::Result<()> {
    println!(
        "Syncing {} to {} on {} with sync method {}",
        local_folder, remote_volume, server_url, sync_method
    );

    // stick together the sync id
    let sync_id = format!("{}-{}-{}", local_folder, sync_method, remote_volume);

    // check if a sync operation with this id is already registered on the user
    // if not, append the sync job to the user
    let mut client_info: FilezClientConfig = match get_client_info(server_url, client_name).await {
        Ok(client_info) => client_info,
        Err(_) => match create_client_info(server_url, client_name, user_id).await {
            Ok(client_info) => client_info,
            Err(e) => return Err(e),
        },
    };
    dbg!(&client_info);

    let sync_operation = match get_sync_operation(&client_info, &sync_id) {
        Ok(sync_operation) => sync_operation,
        Err(_) => {
            match create_sync_operation(
                server_url,
                &mut client_info,
                local_folder,
                remote_volume,
                sync_method,
                &sync_id,
                user_id,
                client_name,
            )
            .await
            {
                Ok(sync_operation) => sync_operation,
                Err(e) => return Err(e),
            }
        }
    };

    // execute the sync job
    match exec_sync_operation(
        server_url,
        sync_operation,
        client_name,
        local_config_dir,
        &sync_id,
    )
    .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn exec_sync_operation(
    address: &str,
    sync_operation: SyncOperation,
    client_name: &str,
    local_config_dir: &str,
    sync_id: &str,
) -> anyhow::Result<(Vec<String>, Vec<String>, Vec<String>)> {
    let mut delete_errors: Vec<String> = vec![];

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
            .map(|f| filez_file_to_intermediary_file(f, client_name))
            .collect();

    let mut remote_file_errors: Vec<String> = vec![];
    let mut remote_files: Vec<IntermediaryFile> = vec![];
    for remote_file in remote_files_results {
        match remote_file {
            Ok(remote_file) => remote_files.push(remote_file),
            Err(e) => remote_file_errors.push(e.to_string()),
        }
    }

    // perform the sync based on comparison and method
    if sync_operation.sync_type == SyncType::Merge {
        // merge local and remote files
        run_merge(
            address,
            client_name,
            sync_operation,
            local_files,
            remote_files,
            local_config_dir,
            sync_id,
        )
        .await;
    } else if sync_operation.sync_type == SyncType::Push
        || sync_operation.sync_type == SyncType::PushDelete
    {
        // push files to remote
        run_push(
            address,
            client_name,
            sync_operation,
            local_files,
            remote_files,
            &mut delete_errors,
        )
        .await;
    } else {
        // pull files from remote
        run_pull(
            address,
            sync_operation,
            local_files,
            remote_files,
            &mut delete_errors,
        )
        .await;
    };
    Ok((local_read_errors, remote_file_errors, delete_errors))
}

pub async fn run_merge(
    address: &str,
    client_name: &str,
    sync_operation: SyncOperation,
    local_files: Vec<IntermediaryFile>,
    remote_files: Vec<IntermediaryFile>,
    local_config_dir: &str,
    sync_id: &str,
) -> anyhow::Result<()> {
    let mut delete_errors: Vec<String> = vec![];
    // DELETE
    // create file list of remote files
    // if file list does not exist we dont perform the delete operation on the first sync
    if let Ok(last_sync_lists) = get_last_sync_lists(local_config_dir, sync_id).await {
        // delete files remote that have been deleted locally since last sync
        let mut local_files_to_delete_remote: Vec<IntermediaryFile> = vec![];
        for local_file in local_files {
            if !last_sync_lists.0.contains(&local_file.client_id) {
                local_files_to_delete_remote.push(local_file);
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
        for remote_file in remote_files {
            if !last_sync_lists.1.contains(&remote_file.client_id) {
                remote_files_to_delete_local.push(remote_file);
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

    // CREATE
    // download/upload new files

    Ok(())
}

pub async fn get_last_sync_lists(
    local_config_dir: &str,
    sync_id: &str,
) -> anyhow::Result<(Vec<String>, Vec<String>)> {
    let local_list_path = Path::new(local_config_dir).join(format!("{}_local", sync_id));
    let local_list_string = match tokio::fs::read_to_string(local_list_path).await {
        Ok(local_list_string) => local_list_string,
        Err(e) => bail!("Failed to read local list file: {}", e),
    };

    let remote_list_path = Path::new(local_config_dir).join(format!("{}_remote", sync_id));
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
    delete_errors: &mut Vec<String>,
) {
    let mut comp_results: Vec<LocalRemoteCompareResult> = vec![];
    for remote_file in &remote_files {
        let mut comp_result = LocalRemoteCompareResult::NotFound;
        for local_file in &local_files {
            match compare_local_and_remote_files(local_file, remote_file) {
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
                        &remote_file.name,
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
}

pub async fn run_push(
    address: &str,
    client_name: &str,
    sync_operation: SyncOperation,
    local_files: Vec<IntermediaryFile>,
    remote_files: Vec<IntermediaryFile>,
    delete_errors: &mut Vec<String>,
) {
    let mut comp_results: Vec<LocalRemoteCompareResult> = vec![];
    for local_file in &local_files {
        let mut comp_result = LocalRemoteCompareResult::NotFound;
        for remote_file in &remote_files {
            match compare_local_and_remote_files(local_file, remote_file) {
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
                            match update_file(address, local_file, client_name, existing_id).await {
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
                match create_file(address, local_file, client_name, &sync_operation.group_id).await
                {
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
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub enum LocalRemoteCompareResult {
    EqualId,
    EqualIdDifferentContent,
    DifferentId,
    NotFound,
}

pub fn compare_local_and_remote_files(
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

#[allow(clippy::too_many_arguments)]
pub async fn create_sync_operation(
    server_url: &str,
    client_info: &mut FilezClientConfig,
    local_folder: &str,
    remote_volume: &str,
    sync_method: &str,
    sync_id: &str,
    user_id: &str,
    client_name: &str,
) -> anyhow::Result<SyncOperation> {
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
    let mut clients_info: HashMap<String, FilezClientConfig> = HashMap::new();

    client_info
        .sync_operations
        .get_or_insert(HashMap::new())
        .insert(sync_id.to_string(), sync_operation.clone());

    clients_info.insert(client_name.to_string(), client_info.clone());

    let sadr = SetAppDataRequest {
        app_data_type: AppDataType::User,
        id: user_id.to_string(),
        app_name: "filezClients".to_string(),
        app_data: serde_json::to_value(clients_info.clone())?,
    };

    set_app_data(server_url, &sadr).await?;
    Ok(sync_operation)
}

pub fn get_sync_operation(
    client_info: &FilezClientConfig,
    sync_id: &str,
) -> anyhow::Result<SyncOperation> {
    match &client_info.sync_operations {
        Some(sync_operations) => match sync_operations.get(sync_id) {
            Some(sync_operation) => Ok(sync_operation.clone()),
            None => bail!("No sync operation with id {} found", sync_id),
        },
        None => {
            bail!("No sync operations found")
        }
    }
}

pub async fn create_client_info(
    server_url: &str,
    client_name: &str,
    user_id: &str,
) -> anyhow::Result<FilezClientConfig> {
    let mut clients_info = HashMap::new();

    let client_info = FilezClientConfig {
        sync_operations: None,
    };

    clients_info.insert(client_name.to_string(), client_info.clone());

    let sadr = SetAppDataRequest {
        app_data_type: AppDataType::User,
        id: user_id.to_string(),
        app_name: "filezClients".to_string(),
        app_data: serde_json::to_value(clients_info.clone())?,
    };

    set_app_data(server_url, &sadr).await?;
    Ok(client_info)
}

pub async fn get_client_info(
    server_url: &str,
    client_name: &str,
) -> anyhow::Result<FilezClientConfig> {
    Ok(match get_user_info(server_url).await {
        Ok(user_info) => {
            // get desktop client info from user info
            match user_info.app_data {
                Some(app_data) => {
                    // app data exists
                    match app_data.get(client_name) {
                        Some(client_info) => {
                            // client info exists
                            let client_infos =
                                match serde_json::from_value::<HashMap<String, FilezClientConfig>>(
                                    client_info.clone(),
                                ) {
                                    Ok(client_info) => client_info,
                                    Err(e) => {
                                        bail!("Could not parse client info: {}", e);
                                    }
                                };
                            match client_infos.get(client_name) {
                                Some(client_info) => client_info.clone(),
                                None => bail!("No client info found"),
                            }
                        }
                        None => {
                            // no user info for this client
                            bail!("no user info for this client");
                        }
                    }
                }
                None => {
                    // create app data
                    bail!("No app data found");
                }
            }
        }
        Err(e) => {
            // could not get user info
            bail!(e)
        }
    })
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

pub fn filez_file_to_intermediary_file(
    f: &FilezFile,
    client_name: &str,
) -> anyhow::Result<IntermediaryFile> {
    let clients_app_data = match &f.app_data {
        Some(app_data) => match app_data.get("filezClients") {
            Some(client_app_data_value) => {
                match serde_json::from_value::<HashMap<String, FilezClientAppDataFile>>(
                    client_app_data_value.clone(),
                ) {
                    Ok(client_app_data) => client_app_data,
                    Err(e) => bail!("Could not deserialize client app data: {}", e),
                }
            }
            None => bail!("Could not find client app data"),
        },
        None => bail!("Could not find app data"),
    };

    let client_app_data = match clients_app_data.get(client_name) {
        Some(client_app_data) => client_app_data,
        None => bail!("Could not find client app data for client {}", client_name),
    };

    Ok(IntermediaryFile {
        name: f.name.clone(),
        modified: client_app_data.modified,
        created: client_app_data.created,
        size: f.size,
        mime_type: f.mime_type.clone(),
        path: client_app_data.path.clone(),
        client_id: some_or_bail!(
            client_app_data.path.clone(),
            "Could not get path to set as id"
        ),
        real_path: None,
        existing_id: Some(f.id.clone()),
    })
}
