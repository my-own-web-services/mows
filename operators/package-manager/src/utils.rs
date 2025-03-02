use crate::types::Manifest;
use anyhow::Context;
use kube::{
    api::{ApiResource, DynamicObject},
    discovery::{ApiCapabilities, Scope},
    Api, Client,
};
use mows_common::templating::{
    functions::{serde_json_hashmap_to_gtmpl_hashmap, TEMPLATE_FUNCTIONS},
    gtmpl::{Context as GtmplContext, Template, Value as GtmplValue},
    gtmpl_derive::Gtmpl,
};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
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

pub async fn replace_cluster_variables(
    directory_path: &PathBuf,
    cluster_variables: &HashMap<String, serde_json::Value>,
) -> anyhow::Result<()> {
    // replace cluster variables in all files recursively
    let file_paths = get_all_file_paths_recursive(&directory_path).await;

    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    #[derive(Gtmpl)]
    struct LocalContext {
        config: HashMap<String, GtmplValue>,
    }

    let context = GtmplContext::from(LocalContext {
        config: serde_json_hashmap_to_gtmpl_hashmap(cluster_variables),
    });

    let temp_token_left = "{lt.pm.reserved.mows.cloud";
    let temp_token_right = "rt.pm.reserved.mows.cloud}";

    for file_path in file_paths {
        let original_file_content = tokio::fs::read_to_string(&file_path)
            .await?
            .replace("{{", &temp_token_left)
            .replace("}}", &temp_token_right)
            .replace("{§", "{{")
            .replace("§}", "}}");

        template_creator
            .parse(&original_file_content)
            .context(format!(
                "Error parsing template: {} with content:\n {}",
                file_path.to_str().unwrap_or(""),
                &original_file_content
            ))?;

        let rendered_content = template_creator.render(&context)?;

        tokio::fs::write(
            &file_path,
            rendered_content
                .replace(temp_token_left, "{{")
                .replace(temp_token_right, "}}"),
        )
        .await?;
    }

    Ok(())
}
