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

    let files = match recursive_read_dir(local_folder) {
        Ok(files) => files,
        Err(e) => return Err(e.to_string()),
    };

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
