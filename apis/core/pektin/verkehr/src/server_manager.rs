use crate::{
    config::routing_config::{Entrypoint, RoutingConfig},
    proxy::{http::create_http_server, tcp::create_tcp_server},
    routing_cache::RoutingCache,
};
use std::{collections::HashMap, sync::Arc};
use tokio::{sync::RwLock, task::JoinHandle};
use tracing::{error, info};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ServerType {
    Http,
    Tcp,
}

struct ServerHandle {
    handle: JoinHandle<()>,
    server_type: ServerType,
    entrypoint: Entrypoint,
}

#[derive(Clone)]
pub struct ServerManager {
    routing_config: Arc<RwLock<RoutingConfig>>,
    http_servers: Arc<RwLock<HashMap<String, ServerHandle>>>,
    tcp_servers: Arc<RwLock<HashMap<String, ServerHandle>>>,
    routing_cache: Arc<RoutingCache>,
}

impl ServerManager {
    pub fn new(routing_config: Arc<RwLock<RoutingConfig>>) -> Self {
        Self {
            routing_config,
            http_servers: Arc::new(RwLock::new(HashMap::new())),
            tcp_servers: Arc::new(RwLock::new(HashMap::new())),
            routing_cache: Arc::new(RoutingCache::new()),
        }
    }

    /// Starts all servers based on the current routing config
    pub async fn start_all(&self) -> anyhow::Result<()> {
        let config = self.routing_config.read().await;

        // Start HTTP servers
        if let Some(http_config) = &config.http {
            if let Some(entrypoints) = &http_config.entrypoints {
                for (name, entrypoint) in entrypoints {
                    self.start_http_server(name, entrypoint).await?;
                }
            }
        }

        // Start TCP servers
        if let Some(tcp_config) = &config.tcp {
            if let Some(entrypoints) = &tcp_config.entrypoints {
                for (name, entrypoint) in entrypoints {
                    self.start_tcp_server(name, entrypoint).await?;
                }
            }
        }

        Ok(())
    }

    /// Watches for config changes and updates servers accordingly
    pub async fn watch_config_changes(&self) {
        let mut previous_config = self.routing_config.read().await.clone();

        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
        loop {
            interval.tick().await;

            let current_config = self.routing_config.read().await.clone();

            // Check for HTTP entrypoint changes
            self.handle_http_changes(&previous_config, &current_config)
                .await;

            // Check for TCP entrypoint changes
            self.handle_tcp_changes(&previous_config, &current_config)
                .await;

            previous_config = current_config;
        }
    }

    async fn handle_http_changes(
        &self,
        previous_config: &RoutingConfig,
        current_config: &RoutingConfig,
    ) {
        let previous_entrypoints = previous_config
            .http
            .as_ref()
            .and_then(|h| h.entrypoints.as_ref());
        let current_entrypoints = current_config
            .http
            .as_ref()
            .and_then(|h| h.entrypoints.as_ref());

        match (previous_entrypoints, current_entrypoints) {
            (None, None) => return,
            (Some(_), None) => {
                // All HTTP entrypoints removed
                info!("All HTTP entrypoints removed, stopping all HTTP servers");
                self.stop_all_http_servers().await;
            }
            (None, Some(current)) => {
                // New HTTP entrypoints added
                for (name, entrypoint) in current {
                    if let Err(e) = self.start_http_server(name, entrypoint).await {
                        error!(
                            entrypoint = %name,
                            error = %e,
                            "Failed to start HTTP server"
                        );
                    }
                }
            }
            (Some(previous), Some(current)) => {
                // Check for changes
                for (name, current_entrypoint) in current {
                    match previous.get(name) {
                        None => {
                            // New entrypoint
                            info!(entrypoint = %name, "New HTTP entrypoint detected");
                            if let Err(e) = self.start_http_server(name, current_entrypoint).await
                            {
                                error!(
                                    entrypoint = %name,
                                    error = %e,
                                    "Failed to start HTTP server"
                                );
                            }
                        }
                        Some(previous_entrypoint) => {
                            // Check if entrypoint config changed
                            if previous_entrypoint != current_entrypoint {
                                info!(
                                    entrypoint = %name,
                                    "HTTP entrypoint config changed, restarting server"
                                );
                                self.stop_http_server(name).await;
                                if let Err(e) =
                                    self.start_http_server(name, current_entrypoint).await
                                {
                                    error!(
                                        entrypoint = %name,
                                        error = %e,
                                        "Failed to restart HTTP server"
                                    );
                                }
                            }
                        }
                    }
                }

                // Check for removed entrypoints
                for name in previous.keys() {
                    if !current.contains_key(name) {
                        info!(entrypoint = %name, "HTTP entrypoint removed");
                        self.stop_http_server(name).await;
                    }
                }
            }
        }
    }

    async fn handle_tcp_changes(
        &self,
        previous_config: &RoutingConfig,
        current_config: &RoutingConfig,
    ) {
        let previous_entrypoints = previous_config
            .tcp
            .as_ref()
            .and_then(|t| t.entrypoints.as_ref());
        let current_entrypoints = current_config
            .tcp
            .as_ref()
            .and_then(|t| t.entrypoints.as_ref());

        match (previous_entrypoints, current_entrypoints) {
            (None, None) => return,
            (Some(_), None) => {
                // All TCP entrypoints removed
                info!("All TCP entrypoints removed, stopping all TCP servers");
                self.stop_all_tcp_servers().await;
            }
            (None, Some(current)) => {
                // New TCP entrypoints added
                for (name, entrypoint) in current {
                    if let Err(e) = self.start_tcp_server(name, entrypoint).await {
                        error!(
                            entrypoint = %name,
                            error = %e,
                            "Failed to start TCP server"
                        );
                    }
                }
            }
            (Some(previous), Some(current)) => {
                // Check for changes
                for (name, current_entrypoint) in current {
                    match previous.get(name) {
                        None => {
                            // New entrypoint
                            info!(entrypoint = %name, "New TCP entrypoint detected");
                            if let Err(e) = self.start_tcp_server(name, current_entrypoint).await {
                                error!(
                                    entrypoint = %name,
                                    error = %e,
                                    "Failed to start TCP server"
                                );
                            }
                        }
                        Some(previous_entrypoint) => {
                            // Check if entrypoint config changed
                            if previous_entrypoint != current_entrypoint {
                                info!(
                                    entrypoint = %name,
                                    "TCP entrypoint config changed, restarting server"
                                );
                                self.stop_tcp_server(name).await;
                                if let Err(e) =
                                    self.start_tcp_server(name, current_entrypoint).await
                                {
                                    error!(
                                        entrypoint = %name,
                                        error = %e,
                                        "Failed to restart TCP server"
                                    );
                                }
                            }
                        }
                    }
                }

                // Check for removed entrypoints
                for name in previous.keys() {
                    if !current.contains_key(name) {
                        info!(entrypoint = %name, "TCP entrypoint removed");
                        self.stop_tcp_server(name).await;
                    }
                }
            }
        }
    }

    async fn start_http_server(
        &self,
        name: &str,
        entrypoint: &Entrypoint,
    ) -> anyhow::Result<()> {
        let has_tls = entrypoint.cert_resolver.is_some();
        let listen_addr = entrypoint.address.clone();
        let entrypoint_name = name.to_string();
        let config_clone = self.routing_config.clone();

        info!(
            entrypoint = %entrypoint_name,
            address = %listen_addr,
            tls = %has_tls,
            "Starting HTTP server"
        );

        let server_future = create_http_server(
            listen_addr,
            has_tls,
            config_clone,
            entrypoint_name.clone(),
            self.routing_cache.clone(),
        )
        .await?;

        let handle = tokio::spawn(async move {
            if let Err(e) = server_future.await {
                error!(
                    entrypoint = %entrypoint_name,
                    error = %e,
                    "HTTP server failed"
                );
            }
        });

        let server_handle = ServerHandle {
            handle,
            server_type: ServerType::Http,
            entrypoint: entrypoint.clone(),
        };

        self.http_servers
            .write()
            .await
            .insert(name.to_string(), server_handle);

        Ok(())
    }

    async fn start_tcp_server(&self, name: &str, entrypoint: &Entrypoint) -> anyhow::Result<()> {
        let has_tls = entrypoint.cert_resolver.is_some();
        let listen_addr = entrypoint.address.clone();
        let entrypoint_name = name.to_string();
        let config_clone = self.routing_config.clone();

        info!(
            entrypoint = %entrypoint_name,
            address = %listen_addr,
            tls = %has_tls,
            "Starting TCP server"
        );

        let entrypoint_name_clone = entrypoint_name.clone();
        let handle = tokio::spawn(async move {
            if let Err(e) =
                create_tcp_server(&listen_addr, has_tls, config_clone, &entrypoint_name_clone)
                    .await
            {
                error!(
                    entrypoint = %entrypoint_name_clone,
                    error = %e,
                    "TCP server failed"
                );
            }
        });

        let server_handle = ServerHandle {
            handle,
            server_type: ServerType::Tcp,
            entrypoint: entrypoint.clone(),
        };

        self.tcp_servers
            .write()
            .await
            .insert(name.to_string(), server_handle);

        Ok(())
    }

    async fn stop_http_server(&self, name: &str) {
        let mut servers = self.http_servers.write().await;
        if let Some(server) = servers.remove(name) {
            server.handle.abort();
            info!(entrypoint = %name, "HTTP server stopped");
        }
    }

    async fn stop_tcp_server(&self, name: &str) {
        let mut servers = self.tcp_servers.write().await;
        if let Some(server) = servers.remove(name) {
            server.handle.abort();
            info!(entrypoint = %name, "TCP server stopped");
        }
    }

    async fn stop_all_http_servers(&self) {
        let mut servers = self.http_servers.write().await;
        for (name, server) in servers.drain() {
            server.handle.abort();
            info!(entrypoint = %name, "HTTP server stopped");
        }
    }

    async fn stop_all_tcp_servers(&self) {
        let mut servers = self.tcp_servers.write().await;
        for (name, server) in servers.drain() {
            server.handle.abort();
            info!(entrypoint = %name, "TCP server stopped");
        }
    }
}
