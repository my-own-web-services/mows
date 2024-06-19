use anyhow::Context;
use axum::error_handling::HandleErrorLayer;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{Method, StatusCode};
use axum::routing::{delete, get, post, put};
use axum::BoxError;
use axum::Router;
use manager::api::boot::*;
use manager::api::cluster::*;
use manager::api::config::*;
use manager::api::machines::*;
use manager::api::terminal::*;
use manager::config::*;
use manager::types::*;
use manager::utils::{get_cluster_config, install_cluster_basics, update_machine_install_state};

use std::time::Duration;
use tokio::process::Command;
use tokio::signal;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::Layer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
/*
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;
#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;
*/

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    #[derive(OpenApi)]
    #[openapi(
        paths(
            update_config,
            get_config,
            create_machines,
            signal_machine,
            create_cluster,
            get_boot_config_by_mac,
            terminal_local,
            delete_machine,
            get_machine_info,
            get_machine_status
        ),
        components(
            schemas(
                ManagerConfig,
                Success,
                Cluster,
                ClusterNode,
                BackupNode,
                ExternalProviders,
                ExternalProvidersHetzner,
                PublicIpConfig,
                PublicIpConfigSingleIp,
                ExternalProviderIpOptions,
                ExternalProviderIpOptionsHetzner,
                SshAccess,
                MachineType,
                Machine,
                MachineCreationReqBody,
                LocalQemuConfig,
                ExternalHetznerConfig,
                ClusterCreationConfig,
                PixiecoreBootConfig,
                MachineInstallState,
                ClusterInstallState,
                MachineSignalReqBody,
                MachineSignal,
                MachineDeleteReqBody,
                MachineInfoReqBody,
                MachineInfoResBody,
                MachineStatus
            )
        ),
        tags(
            (name = "cluster-manager", description = "Cluster management API")
        )
    )]
    struct ApiDoc;

    let console_layer = console_subscriber::ConsoleLayer::builder()
        .server_addr(([0, 0, 0, 0], 6669))
        .spawn()
        .with_filter(tracing_subscriber::EnvFilter::new(
            "main=trace,manager=trace,tower_http=trace,axum::rejection=trace,tokio=trace,runtime=trace"
            ,
        ));

    let log_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        // axum logs rejections from built-in extractors with the `axum::rejection`
        // target, at `TRACE` level. `axum::rejection=trace` enables showing those events
        "main=debug,manager=debug,tower_http=trace,axum::rejection=trace,tokio=debug,runtime=debug"
            .into()
    });
    let log_layer = tracing_subscriber::fmt::layer().with_filter(log_filter);

    tracing_subscriber::registry()
        .with(console_layer)
        .with(log_layer)
        .init();

    //Machine::delete_all_mows_machines().unwrap();

    let serve_dir = ServeDir::new("ui").not_found_service(ServeFile::new("ui/index.html"));

    let api_url = "http://0.0.0.0:3000";

    let origins = ["http://localhost:5173".parse()?, api_url.parse()?];

    info!("Starting pixiecore servers");
    Command::new("pixiecore")
        .args(["api", api_url, "-l", "192.168.111.3", "--dhcp-no-bind"])
        .spawn()
        .context("Failed to start pixiecore server for direct attach")?;
    Command::new("pixiecore")
        .args(["api", api_url, "-l", "192.168.112.3", "--dhcp-no-bind"])
        .spawn()
        .context("Failed to start pixiecore server for qemu")?;

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/api/config", put(update_config))
        .route("/api/config", get(get_config))
        .route("/api/machines/create", post(create_machines))
        .route("/api/machines/signal", post(signal_machine))
        .route("/api/machines/delete", delete(delete_machine))
        .route("/api/machines/info", post(get_machine_info))
        .route("/api/machines/status", get(get_machine_status))
        .route("/api/cluster/create", post(create_cluster))
        .route("/api/terminal/local", get(terminal_local))
        .route("/v1/boot/:mac_addr", get(get_boot_config_by_mac))
        .nest_service("/", serve_dir)
        .layer(
            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([CONTENT_TYPE, UPGRADE]),
        )
        .layer(
            ServiceBuilder::new()
                .layer(HandleErrorLayer::new(|error: BoxError| async move {
                    if error.is::<tower::timeout::error::Elapsed>() {
                        Ok(StatusCode::REQUEST_TIMEOUT)
                    } else {
                        Err((
                            StatusCode::INTERNAL_SERVER_ERROR,
                            format!("Unhandled internal error: {error}"),
                        ))
                    }
                }))
                .timeout(Duration::from_secs(5))
                .layer(TraceLayer::new_for_http())
                .into_inner(),
        );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;

    info!("Open http://localhost:3000 in your browser");

    info!("Starting background tasks");
    // these are separated for easier debugging
    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = update_machine_install_state().await {
                info!("Could not update machine install state: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = get_cluster_config().await {
                info!("Could not get cluster config: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = install_cluster_basics().await {
                info!("Could not install cluster basics: {:?}", e);
            };
        }
    });

    info!("Starting server");
    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
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
