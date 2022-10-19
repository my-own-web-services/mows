#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::{collections::HashMap, fs::DirEntry, vec};

use anyhow::bail;
use filez::{
    api_types::{AppDataType, FilezFile, SetAppDataRequest},
    methods::{
        create_file::create_file, get_file_infos_by_group_id::get_file_infos_by_group_id,
        get_user_info::get_user_info, set_app_data::set_app_data, update_file::update_file,
    },
    some_or_bail,
    types::{FilezClientAppDataFile, FilezClientConfig, IntermediaryFile, SyncOperation, SyncType},
    utils::{generate_id, get_created_time_secs, get_modified_time_secs, recursive_read_dir},
};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
async fn sync(
    server_url: &str,
    local_folder: &str,
    remote_volume: &str,
    sync_method: &str,
) -> Result<(), String> {
    let client_name = "hartmut";
    let user_id = "test";
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
            Err(e) => return Err(e.to_string()),
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
                Err(e) => return Err(e.to_string()),
            }
        }
    };

    // execute the sync job
    match exec_sync_operation(server_url, sync_operation, client_name).await {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
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

pub fn filez_file_to_intermediary_file(
    f: &FilezFile,
    client_name: &str,
) -> anyhow::Result<IntermediaryFile> {
    let client_app_data = match &f.app_data {
        Some(app_data) => match app_data.get(client_name) {
            Some(client_app_data_value) => {
                match serde_json::from_value::<FilezClientAppDataFile>(
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

    Ok(IntermediaryFile {
        name: f.name.clone(),
        modified: client_app_data.modified,
        created: client_app_data.created,
        size: f.size,
        mime_type: f.mime_type.clone(),
        path: client_app_data.path.clone(),
        client_id: some_or_bail!(client_app_data.path, "Could not get path to set as id"),
        real_path: None,
        existing_id: Some(f.id.clone()),
    })
}

pub async fn exec_sync_operation(
    address: &str,
    sync_operation: SyncOperation,
    client_name: &str,
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

    // compare the files
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

    // perform the sync based on comparison and method
    if sync_operation.sync_type == SyncType::Merge {
        // merge local and remote files
        todo!()
    } else if sync_operation.sync_type == SyncType::Push
        || sync_operation.sync_type == SyncType::PushDelete
    {
        let mut files_to_delete: Vec<String> = vec![];
        // push files
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
                                match update_file(address, local_file, client_name, existing_id)
                                    .await
                                {
                                    Ok(_) => match &local_file.real_path {
                                        Some(real_path) => {
                                            files_to_delete.push(real_path.to_string())
                                        }
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
                    match create_file(address, local_file, client_name, &sync_operation.group_id)
                        .await
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
            files_to_delete.iter().for_each(|f| {
                match std::fs::remove_file(f) {
                    Ok(_) => (),
                    Err(e) => delete_errors.push(e.to_string()),
                };
            });
        }
    } else {
        // pull files
        todo!();
        if sync_operation.sync_type == SyncType::PullDelete {
            // delete files remotely that were successfully pulled
            todo!()
        }
    };
    Ok((local_read_errors, remote_file_errors, delete_errors))
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
            "push" => filez::types::SyncType::Push,
            "pushDelete" => filez::types::SyncType::PushDelete,
            "pull" => filez::types::SyncType::Pull,
            "pullDelete" => filez::types::SyncType::PullDelete,
            "merge" => filez::types::SyncType::Merge,
            _ => bail!("Invalid sync method"),
        },
    };

    let client_info = client_info;
    client_info
        .sync_operations
        .get_or_insert(HashMap::new())
        .insert(sync_id.to_string(), sync_operation.clone());

    let sadr = SetAppDataRequest {
        app_data_type: AppDataType::User,
        id: user_id.to_string(),
        app_name: client_name.to_string(),
        app_data: serde_json::to_value(client_info.clone())?,
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
    let client_info = FilezClientConfig {
        sync_operations: None,
    };

    let sadr = SetAppDataRequest {
        app_data_type: AppDataType::User,
        id: user_id.to_string(),
        app_name: client_name.to_string(),
        app_data: serde_json::to_value(client_info.clone())?,
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
                            let client_info: FilezClientConfig =
                                match serde_json::from_value(client_info.clone()) {
                                    Ok(client_info) => client_info,
                                    Err(e) => {
                                        bail!("Could not parse client info: {}", e);
                                    }
                                };
                            client_info
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
