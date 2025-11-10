use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use std::time::Duration;
use tracing::{debug, error, info, warn};
use verkehr::{
    config::{
        config,
        providers::{docker::get_config_from_docker_labels, file::load_directory_config},
    },
    kubernetes_controller::run_controller,
    server_manager::ServerManager,
    state::VerkehrState,
};

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Install default crypto provider for rustls before any TLS operations
    let _ = rustls::crypto::ring::default_provider().install_default();

    let _config = get_current_config_cloned!(config());
    let _common_config = get_current_config_cloned!(common_config(true));
    init_observability().await;

    info!("Starting Verkehr");

    let state = VerkehrState::new().await?;
    let routing_config = state.routing_config.clone();
    let verkehr_config = get_current_config_cloned!(config());

    // Start the Kubernetes controller in the background if enabled (optional - won't block app)
    if verkehr_config.kubernetes_controller_enabled {
        let controller_state = state.clone();
        tokio::spawn(async move {
            info!("Attempting to start Kubernetes controller");
            match run_controller(controller_state).await {
                Ok(_) => {
                    info!("Kubernetes controller stopped gracefully");
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        "Kubernetes controller failed to start or encountered an error. \
                        This is expected if not running in a Kubernetes cluster. \
                        The application will continue running without the controller."
                    );
                }
            }
        });
    } else {
        info!("Kubernetes controller is disabled via configuration");
    }

    // Create server manager
    let server_manager = ServerManager::new(routing_config.clone());

    // Start file provider watcher if directory path is configured
    if let Some(directory_path) = &verkehr_config.file_provider_directory_path {
        let directory_path = directory_path.clone();
        let routing_config_clone = routing_config.clone();

        info!(
            directory = %directory_path,
            "Starting file provider watcher"
        );

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            loop {
                interval.tick().await;

                debug!("Reloading config from file provider directory");

                match load_directory_config(&directory_path) {
                    Ok(new_config) => {
                        let mut config = routing_config_clone.write().await;
                        *config = new_config;
                        info!("Routing config reloaded from file provider");
                        debug!(
                            config = ?*config,
                            "Updated merged routing config"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = %e,
                            directory = %directory_path,
                            "Failed to load config from file provider directory"
                        );
                    }
                }
            }
        });
    }

    // Start docker provider watcher if enabled
    if verkehr_config.docker_provider_enabled {
        let routing_config_clone = routing_config.clone();

        info!("Starting docker provider watcher");

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            loop {
                interval.tick().await;

                debug!("Reloading config from docker provider");

                match get_config_from_docker_labels().await {
                    Ok(configs) => {
                        let mut combined_config =
                            verkehr::config::routing_config::RoutingConfig::default();

                        for config in configs {
                            combined_config.merge(config);
                        }

                        let mut config = routing_config_clone.write().await;
                        *config = combined_config;
                        info!("Routing config reloaded from docker provider");
                        debug!(
                            config = ?*config,
                            "Updated merged routing config"
                        );
                    }
                    Err(e) => {
                        error!(
                            error = %e,
                            "Failed to load config from docker provider"
                        );
                    }
                }
            }
        });
    }

    // Start all servers based on current config
    server_manager.start_all().await?;
    info!("All initial proxy servers started");

    // Start config watcher that will restart/stop/start servers on changes
    let watcher_handle = tokio::spawn(async move {
        server_manager.watch_config_changes().await;
    });

    // Keep the application running - wait for config watcher
    // (it never exits, so this keeps the app alive)
    match watcher_handle.await {
        Ok(_) => {
            info!("Config watcher stopped");
        }
        Err(e) => {
            error!(error = %e, "Config watcher panicked");
        }
    }

    Ok(())
}
