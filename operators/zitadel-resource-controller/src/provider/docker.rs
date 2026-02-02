use std::collections::HashMap;

use bollard::query_parameters::{
    EventsOptionsBuilder, InspectContainerOptions, ListContainersOptionsBuilder,
};
use bollard::Docker;
use futures::StreamExt;
use tokio::time::Duration;
use tracing::{debug, error, info, instrument, warn};

use crate::handlers::raw::{apply_raw, cleanup_raw};
use crate::resource_types::RawZitadelResource;
use crate::ControllerError;

use super::docker_label_parser::{parse_labels, LabelParseError};

/// Tracks a known resource along with its scope and name for cleanup.
struct TrackedResource {
    scope: String,
    name: String,
    resource: RawZitadelResource,
}

pub struct DockerProvider {
    docker: Docker,
    poll_interval_seconds: u64,
    label_prefix: String,
}

impl DockerProvider {
    pub fn new(
        socket_path: &str,
        poll_interval_seconds: u64,
        label_prefix: String,
    ) -> Result<Self, ControllerError> {
        let docker =
            Docker::connect_with_socket(socket_path, 120, bollard::API_DEFAULT_VERSION)
                .map_err(|e| {
                    ControllerError::GenericError(format!(
                        "Failed to connect to Docker socket at {}: {}",
                        socket_path, e
                    ))
                })?;

        Ok(Self {
            docker,
            poll_interval_seconds,
            label_prefix,
        })
    }

    /// Run the Docker provider's main loop.
    ///
    /// Uses Docker events for reactive updates with periodic full resync as a safety net.
    /// Reconnects the event stream with exponential backoff on errors.
    #[instrument(skip(self), level = "info")]
    pub async fn run(&self) -> Result<(), ControllerError> {
        let mut known_resources: HashMap<String, TrackedResource> = HashMap::new();

        // Initial full sync
        info!("Docker provider starting initial sync");
        self.full_sync(&mut known_resources).await;

        let mut backoff_seconds: u64 = 1;
        const MAX_BACKOFF_SECONDS: u64 = 60;

        loop {
            let event_options = EventsOptionsBuilder::new()
                .filters(&HashMap::from([
                    ("type".to_string(), vec!["container".to_string()]),
                    (
                        "event".to_string(),
                        vec![
                            "start".to_string(),
                            "stop".to_string(),
                            "die".to_string(),
                            "destroy".to_string(),
                        ],
                    ),
                ]))
                .build();
            let mut event_stream = self.docker.events(Some(event_options));

            let mut resync_interval =
                tokio::time::interval(Duration::from_secs(self.poll_interval_seconds));

            let stream_failed = loop {
                tokio::select! {
                    event_result = event_stream.next() => {
                        match event_result {
                            Some(Ok(msg)) => {
                                // Reset backoff on successful event
                                backoff_seconds = 1;

                                let action = msg.action.as_deref().unwrap_or("unknown");
                                let container_id = msg.actor
                                    .as_ref()
                                    .and_then(|a| a.id.as_deref())
                                    .unwrap_or("unknown");

                                debug!("Docker event: {} for container {}", action, container_id);

                                match action {
                                    "start" => {
                                        self.handle_container_start(container_id, &mut known_resources).await;
                                    }
                                    "stop" | "die" | "destroy" => {
                                        self.handle_container_stop(container_id, &mut known_resources).await;
                                    }
                                    _ => {}
                                }
                            }
                            Some(Err(e)) => {
                                warn!("Docker event stream error: {:?}", e);
                                break true;
                            }
                            None => {
                                warn!("Docker event stream ended unexpectedly");
                                break true;
                            }
                        }
                    }
                    _ = resync_interval.tick() => {
                        debug!("Docker provider periodic resync");
                        self.full_sync(&mut known_resources).await;
                    }
                }
            };

            if stream_failed {
                warn!(
                    "Reconnecting Docker event stream in {} seconds",
                    backoff_seconds
                );
                tokio::time::sleep(Duration::from_secs(backoff_seconds)).await;
                backoff_seconds = (backoff_seconds * 2).min(MAX_BACKOFF_SECONDS);

                // Do a full resync after reconnecting to catch any events we missed
                self.full_sync(&mut known_resources).await;
            }
        }
    }

    /// Perform a full sync: list all running containers and reconcile.
    async fn full_sync(&self, known_resources: &mut HashMap<String, TrackedResource>) {
        let list_options = ListContainersOptionsBuilder::new().all(false).build();
        let containers = match self
            .docker
            .list_containers(Some(list_options))
            .await
        {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to list Docker containers: {:?}", e);
                return;
            }
        };

        let mut current_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

        for container in &containers {
            let container_id = match &container.id {
                Some(id) => id.clone(),
                None => continue,
            };
            current_ids.insert(container_id.clone());

            let labels = match &container.labels {
                Some(l) => l,
                None => continue,
            };

            let prefix_dot = format!("{}.", self.label_prefix);
            let has_zrc_labels = labels.keys().any(|k| k.starts_with(&prefix_dot));
            if !has_zrc_labels {
                continue;
            }

            let container_name = container
                .names
                .as_ref()
                .and_then(|n| n.first())
                .map(|n| n.trim_start_matches('/').to_string())
                .unwrap_or_else(|| container_id.clone());

            // Extract scope and name from labels, falling back to defaults
            let scope = labels
                .get(&format!("{}.scope", self.label_prefix))
                .cloned()
                .unwrap_or_else(|| "docker".to_string());
            let name = labels
                .get(&format!("{}.name", self.label_prefix))
                .cloned()
                .unwrap_or_else(|| container_name.clone());

            match parse_labels(labels, &self.label_prefix) {
                Ok(resource) => {
                    if let Err(e) = apply_raw(&scope, &name, &resource).await {
                        error!(
                            "Failed to apply resource for container {} ({}): {:?}",
                            container_name, container_id, e
                        );
                    } else {
                        debug!(
                            "Applied resource for container {} (scope={}, name={})",
                            container_name, scope, name
                        );
                        known_resources.insert(
                            container_id.clone(),
                            TrackedResource {
                                scope,
                                name,
                                resource,
                            },
                        );
                    }
                }
                Err(LabelParseError::NoLabelsFound(_)) => {
                    // Container doesn't have resource labels, skip
                }
                Err(e) => {
                    warn!(
                        "Failed to parse labels for container {} ({}): {:?}",
                        container_name, container_id, e
                    );
                }
            }
        }

        // Cleanup resources for containers that are no longer running
        let removed_ids: Vec<String> = known_resources
            .keys()
            .filter(|id| !current_ids.contains(*id))
            .cloned()
            .collect();

        for id in removed_ids {
            self.handle_container_stop(&id, known_resources).await;
        }
    }

    /// Handle a container start event: inspect and apply resource if applicable.
    async fn handle_container_start(
        &self,
        container_id: &str,
        known_resources: &mut HashMap<String, TrackedResource>,
    ) {
        let inspect = match self
            .docker
            .inspect_container(container_id, None::<InspectContainerOptions>)
            .await
        {
            Ok(info) => info,
            Err(e) => {
                warn!(
                    "Failed to inspect container {}: {:?}",
                    container_id, e
                );
                return;
            }
        };

        let labels = match inspect.config.and_then(|c| c.labels) {
            Some(l) => l,
            None => return,
        };

        let prefix_dot = format!("{}.", self.label_prefix);
        if !labels.keys().any(|k| k.starts_with(&prefix_dot)) {
            return;
        }

        let container_name = inspect
            .name
            .as_deref()
            .map(|n| n.trim_start_matches('/'))
            .unwrap_or(container_id);

        let scope = labels
            .get(&format!("{}.scope", self.label_prefix))
            .cloned()
            .unwrap_or_else(|| "docker".to_string());
        let name = labels
            .get(&format!("{}.name", self.label_prefix))
            .cloned()
            .unwrap_or_else(|| container_name.to_string());

        match parse_labels(&labels, &self.label_prefix) {
            Ok(resource) => {
                if let Err(e) = apply_raw(&scope, &name, &resource).await {
                    error!(
                        "Failed to apply resource for container {}: {:?}",
                        container_name, e
                    );
                } else {
                    info!(
                        "Applied resource for container {} (scope={}, name={})",
                        container_name, scope, name
                    );
                    known_resources.insert(
                        container_id.to_string(),
                        TrackedResource {
                            scope,
                            name,
                            resource,
                        },
                    );
                }
            }
            Err(e) => {
                warn!(
                    "Failed to parse labels for container {}: {:?}",
                    container_name, e
                );
            }
        }
    }

    /// Handle a container stop/die/destroy event: cleanup the associated resource.
    async fn handle_container_stop(
        &self,
        container_id: &str,
        known_resources: &mut HashMap<String, TrackedResource>,
    ) {
        if let Some(tracked) = known_resources.remove(container_id) {
            info!(
                "Cleaning up resource for removed container {} (scope={}, name={})",
                container_id, tracked.scope, tracked.name
            );
            if let Err(e) = cleanup_raw(&tracked.scope, &tracked.name, &tracked.resource).await {
                error!(
                    "Failed to cleanup resource for container {}: {:?}",
                    container_id, e
                );
            }
        }
    }
}
