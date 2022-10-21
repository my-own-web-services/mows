#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use filez::sync::run_sync;

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

    match run_sync(
        server_url,
        local_folder,
        remote_volume,
        sync_method,
        client_name,
        user_id,
    )
    .await
    {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
