use crate::{
    docker_labels::traefik_labels::convert_traefik_labels_to_config, routing_config::RoutingConfig,
};
use anyhow::bail;
use bollard::{query_parameters::ListContainersOptions, Docker};
use std::{collections::HashMap, vec};
mod traefik_labels;

pub async fn get_config_from_docker_labels() -> anyhow::Result<Vec<RoutingConfig>> {
    let docker = Docker::connect_with_socket_defaults()?;

    // Use the new OpenAPI generated types with default options
    let options = ListContainersOptions::default();
    let containers = docker.list_containers(Some(options)).await?;

    let mut container_config: Vec<RoutingConfig> = vec![];

    for container in containers {
        //dbg!(&container);

        let mut traefik_labels = HashMap::<String, String>::new();
        let labels = container.labels.unwrap_or_default();
        if let Some(name) = container.names {
            for label in &labels {
                if label.0.starts_with("traefik") {
                    traefik_labels.insert(label.0.clone(), label.1.clone());
                }
            }
            if !traefik_labels.is_empty() {
                let name = name[0][1..].to_string();
                container_config.push(
                    match convert_traefik_labels_to_config(traefik_labels, &name) {
                        Ok(c) => c,
                        Err(e) => {
                            bail!(
                                r#"Error converting labels to config for container "{}": {}"#,
                                name,
                                e
                            )
                        }
                    },
                );
            }
        }
    }
    Ok(container_config)
}
