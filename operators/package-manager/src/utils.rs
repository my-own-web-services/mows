use std::path::{Path, PathBuf};

use tokio::signal;

use crate::types::MowsManifest;

pub async fn parse_manifest(input: &str) -> anyhow::Result<MowsManifest> {
    // this workaround is needed because serde_yaml does not support nested enums

    let yaml_value: serde_yaml::Value = serde_yaml::from_str(input)?;
    let json_string = serde_json::to_string(&yaml_value)?;
    let manifest: MowsManifest = serde_json::from_str(&json_string)?;

    Ok(manifest)
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

pub async fn get_all_file_paths_recursive(path: &Path) -> Vec<PathBuf> {
    let mut file_paths = Vec::new();

    let mut dir = tokio::fs::read_dir(path).await.unwrap();

    while let Some(entry) = dir.next_entry().await.unwrap() {
        let path = entry.path();

        if path.is_dir() {
            file_paths.append(&mut Box::pin(get_all_file_paths_recursive(&path)).await);
        } else {
            file_paths.push(path);
        }
    }

    file_paths
}
