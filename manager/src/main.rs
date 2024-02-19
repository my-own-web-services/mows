use axum::error_handling::HandleErrorLayer;
use axum::http::header::CONTENT_TYPE;
use axum::http::{ Method, StatusCode};
use axum::routing::{delete, get, put};
use axum::BoxError;
use axum::{routing::post, Router};
use manager::api;
use manager::api::*;
use manager::config::*;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use std::io::Error;
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;
use tokio::signal;
use tokio::sync::Mutex;
use tower_http::services::{ServeDir, ServeFile};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use tower_http::cors::CorsLayer;
use manager::machines::{MachineCreationConfig,ExternalHetznerConfig,LocalQemuConfig};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use manager::cluster::ClusterCreationConfig;



#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> Result<(), Error> {
    #[derive(OpenApi)]
    #[openapi(
        paths(
            api::update_config,
            api::get_config,
            api::create_machines,
            api::delete_all_machines,
            api::create_cluster,
            api::get_boot_config_by_mac

        ),
        components(
            schemas(
                Config, 
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
                MachineCreationConfig, 
                LocalQemuConfig, 
                ExternalHetznerConfig,
                ClusterCreationConfig,
                PixiecoreBootConfig,
                InstallState
            
            )
        ),
        tags(
            (name = "cluster-manager", description = "Cluster management API")
        )
    )]
    struct ApiDoc;

    console_subscriber::init();

/*
    tracing_subscriber::registry()
    .with(
        tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            // axum logs rejections from built-in extractors with the `axum::rejection`
            // target, at `TRACE` level. `axum::rejection=trace` enables showing those events
            "manager=debug,tower_http=debug,axum::rejection=trace".into()
        }),
    )
    .with(tracing_subscriber::fmt::layer())
    .init();
*/

    let config = Arc::new(Mutex::new(Config::default()));

    /*
    let config_handle = config.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let config_locked1 = config_handle.lock().await;
            let cfg1= config_locked1.clone();
            drop(config_locked1);

            for machine in cfg1.machines.values() {
                if machine.poll_install_state(&cfg1.clusters).await.is_ok(){
                    let mut config_locked2 = config_handle.lock().await;
                    let machine = config_locked2.machines.get_mut(&machine.name).unwrap();
                    machine.install.as_mut().unwrap().state = Some(InstallState::Installed);
                    drop(config_locked2);

                }
            }
        }
    });

*/

    //Machine::delete_all_mows_machines().unwrap();

    let serve_dir = ServeDir::new("ui").not_found_service(ServeFile::new("ui/index.html"));


    let api_url = "http://localhost:3000";

    let origins = [
        "http://localhost:5173".parse().unwrap(),
        api_url.parse().unwrap(),
    ];



    Command::new("pixiecore").args(["api",api_url,"-l","192.168.111.3"]).spawn()?;


    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/api/config", put(update_config))
        .route("/api/config", get(get_config))
        .route("/api/machines/create", post(create_machines))
        .route("/api/machines/deleteall", delete(delete_all_machines))
        .route("/api/cluster/create", post(create_cluster))
        .route("/v1/boot/:mac_addr", get(get_boot_config_by_mac))
        .nest_service("/", serve_dir)
        .layer(CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET,Method::POST,Method::PUT]).allow_headers([CONTENT_TYPE]))
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
                .timeout(Duration::from_secs(2000))
                .layer(TraceLayer::new_for_http())
                .into_inner(),
        )
        .with_state(config);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    println!("Open http://localhost:3000 in your browser");

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
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


