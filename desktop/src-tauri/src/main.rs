#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs::DirEntry;

use filez::some_or_bail;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn sync(server_url: &str, local_folder: &str, remote_volume: &str) -> tauri::Result<()> {
    println!(
        "Syncing {} to {} on {}",
        local_folder, remote_volume, server_url
    );

    let files = match recursive_read_dir(local_folder) {
        Ok(files) => files,
        Err(e) => {
            return Err(tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                e,
            )))
        }
    };

    // calculate the hash of each file

    dbg!(files);

    Ok(())
}

pub fn recursive_read_dir(path: &str) -> anyhow::Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            entries.extend(recursive_read_dir(some_or_bail!(
                path.to_str(),
                "Could not convert path to sr"
            ))?);
        } else {
            entries.push(entry);
        }
    }
    Ok(entries)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
