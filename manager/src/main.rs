use anyhow::Context;
use axum::error_handling::HandleErrorLayer;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{Method, StatusCode};
use axum::routing::{delete, get, post, put};
use axum::BoxError;
use axum::Router;
use bollard::Docker;
use manager::api::boot::*;
use manager::api::cluster::*;
use manager::api::config::*;
use manager::api::direct_terminal::*;
use manager::api::docker_terminal::*;
use manager::api::machines::*;
use manager::config::*;
use manager::tasks::{
    apply_environment, get_cluster_kubeconfig, install_cluster_basics, start_cluster_proxy,
    update_machine_install_state,
};
use manager::types::*;

use tracing_subscriber::fmt::time;
use tracing_subscriber::util::SubscriberInitExt;

use std::net::SocketAddr;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::signal;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::{error, info, trace};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::Layer;
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
            dev_create_cluster_from_all_machines_in_inventory,
            get_boot_config_by_mac,
            delete_machine,
            get_machine_info,
            get_machine_status,
            dev_delete_all_machines,
            docker_terminal,
            direct_terminal,
            dev_install_cluster_basics
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

    let _ = Docker::connect_with_local_defaults();

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
    let log_layer = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .with_level(true)
        .with_timer(time::ChronoLocal::new("%H:%M:%S".to_string()))
        .with_file(true)
        .with_line_number(true)
        .with_filter(log_filter);
    /*
        let tracing_layer = tracing_opentelemetry::OpenTelemetryLayer::new(
            manager::tracing::init_tracer("http://jaeger:4317"),
        )
        .with_filter(tracing_subscriber::EnvFilter::new(
            "main=trace,manager=trace,tower_http=trace,axum::rejection=trace,tokio=trace,runtime=trace",
        ));
    */
    tracing_subscriber::registry()
        .with(console_layer)
        .with(log_layer)
        //.with(tracing_layer)
        .try_init()?;

    //Machine::delete_all_mows_machines().unwrap();

    let serve_dir = ServeDir::new("ui").not_found_service(ServeFile::new("ui/index.html"));

    let api_url = "http://0.0.0.0:3000";

    let origins = ["http://localhost:5173".parse()?, api_url.parse()?];

    info!("Starting pixiecore server");

    Command::new("pixiecore")
        .args(["api", api_url, "-l", "192.168.112.3", "--dhcp-no-bind"])
        .stdout(Stdio::null())
        .spawn()
        .context("Failed to start pixiecore server")?;

    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/api/config", put(update_config))
        .route("/api/config", get(get_config))
        .route("/api/machines/create", post(create_machines))
        .route("/api/machines/signal", post(signal_machine))
        .route("/api/machines/delete", delete(delete_machine))
        .route("/api/machines/info", post(get_machine_info))
        .route("/api/machines/status", get(get_machine_status))
        .route(
            "/api/dev/machines/delete_all",
            delete(dev_delete_all_machines),
        )
        .route(
            "/api/dev/cluster/create_from_all_machines_in_inventory",
            post(dev_create_cluster_from_all_machines_in_inventory),
        )
        .route(
            "/api/dev/cluster/install_basics",
            post(dev_install_cluster_basics),
        )
        .route("/api/terminal/direct/:id", get(direct_terminal))
        .route("/api/terminal/docker/:id", get(docker_terminal))
        .route("/v1/boot/:mac_addr", get(get_boot_config_by_mac))
        .nest_service("/", serve_dir)
        .layer(
            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([CONTENT_TYPE, UPGRADE]),
        );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;

    info!("Open http://localhost:3000 in your browser");

    info!("Starting background tasks");
    // these are separated for easier debugging
    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = update_machine_install_state().await {
                trace!("Could not update machine install state: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = apply_environment().await {
                trace!("Failed to apply environment: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = get_cluster_kubeconfig().await {
                trace!("Could not get cluster config: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = install_cluster_basics().await {
                error!("Could not install cluster basics: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        let mut proxy_running = false;
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if proxy_running {
                continue;
            }
            match start_cluster_proxy().await {
                Ok(true) => {
                    proxy_running = true;
                }
                Ok(false) => {}
                Err(e) => {
                    error!("Could not start cluster proxy: {:?}", e);
                }
            }
        }
    });

    info!("Starting server");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
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
