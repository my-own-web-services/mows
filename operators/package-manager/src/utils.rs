use crate::types::Manifest;
use kube::{
    api::{ApiResource, DynamicObject},
    discovery::{ApiCapabilities, Scope},
    Api, Client,
};
use serde::de::Error;
use serde::{Deserialize, Deserializer};
use std::path::{Path, PathBuf};
use tokio::signal;

pub async fn parse_manifest(input: &str) -> anyhow::Result<Manifest> {
    // this workaround is needed because serde_yaml does not support nested enums

    let yaml_value: serde_yaml_ng::Value = serde_yaml_ng::from_str(input)?;
    let json_string = serde_json::to_string(&yaml_value)?;
    let manifest: Manifest = serde_json::from_str(&json_string)?;

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
/// all: Ignore namespace and return cluster-wide API
pub fn get_dynamic_kube_api(
    api_resource: ApiResource,
    api_capabilities: ApiCapabilities,
    client: Client,
    namespace: Option<&str>,
    all: bool,
) -> Api<DynamicObject> {
    if api_capabilities.scope == Scope::Cluster || all {
        Api::all_with(client, &api_resource)
    } else if let Some(namespace) = namespace {
        Api::namespaced_with(client, namespace, &api_resource)
    } else {
        Api::default_namespaced_with(client, &api_resource)
    }
}
