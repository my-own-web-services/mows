#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use filez::utils::{get_modified_time_secs, recursive_read_dir};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn sync(
    server_url: &str,
    local_folder: &str,
    remote_volume: &str,
    sync_method: &str,
) -> Result<(), String> {
    println!(
        "Syncing {} to {} on {} with sync method {}",
        local_folder, remote_volume, server_url, sync_method
    );

    // stick together the sync id
    let sync_id = format!("{}-{}-{}", local_folder, sync_method, remote_volume);

    // check if a sync operation with this id is already registered on the user

    // if not, append the sync job to the user

    // execute the sync job

    // get all remote files that have the group id of the sync job

    // get all local files

    let files = match recursive_read_dir(local_folder) {
        Ok(files) => files,
        Err(e) => return Err(e.to_string()),
    };

    // compare local and remote files

    let fm: Vec<_> = files.iter().filter_map(get_modified_time_secs).collect();

    dbg!(&fm);

    dbg!(files);

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
