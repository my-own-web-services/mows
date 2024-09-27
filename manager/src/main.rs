use anyhow::Context;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{HeaderValue, Method};
use axum::routing::{delete, get, post, put};
use axum::Router;
use manager::api::boot::*;
use manager::api::cluster::*;
use manager::api::config::*;
use manager::api::direct_terminal::*;
use manager::api::machines::*;
use manager::api::public_ip::*;
use manager::config::*;
use manager::internal_config::INTERNAL_CONFIG;
use manager::machines::MachineType;
use manager::providers::hcloud::machine::ExternalMachineProviderHcloudConfig;
use manager::providers::qemu::machine::LocalMachineProviderQemuConfig;
use manager::tasks::start_background_tasks;
use manager::tracing::start_tracing;
use manager::types::*;
use manager::utils::{shutdown_signal, start_dnsmasq, start_pixiecore};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;
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
            direct_terminal,
            dev_install_cluster_basics,
            create_public_ip
        ),
        components(
            schemas(
                ApiResponseStatus,
                ApiResponse<()>,
                ManagerConfig,
                Cluster,
                ClusterNode,
                BackupNode,
                ExternalProviderIpOptionsHetzner,
                SshAccess,
                MachineType,
                MachineCreationReqType,
                Machine,
                MachineCreationReqBody,
                LocalMachineProviderQemuConfig,
                ExternalMachineProviderHcloudConfig,
                ClusterCreationConfig,
                PixiecoreBootConfig,
                MachineInstallState,
                ClusterInstallState,
                MachineSignalReqBody,
                MachineSignal,
                MachineDeleteReqBody,
                MachineInfoReqBody,
                MachineInfoResBody,
                MachineStatus,
                PublicIpCreationConfig,
                PublicIpCreationConfigType,
            )
        ),
        tags(
            (name = "mows-manager", description = "Cluster management API")
        )
    )]
    struct ApiDoc;

    let ic = &INTERNAL_CONFIG;

    //Machine::delete_all_mows_machines().unwrap();

    let serve_dir = ServeDir::new("ui").not_found_service(ServeFile::new("ui/index.html"));

    start_tracing().await.context("Failed to start tracing")?;

    start_pixiecore()
        .await
        .context("Failed to start Pixiecore")?;

    start_dnsmasq().await.context("Failed to start Dnsmasq")?;

    let mut origins = vec![&ic.primary_origin];

    if ic.dev.enabled {
        let _ = &ic.dev.allow_origins.iter().for_each(|x| origins.push(x));
    }

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
        .route("/api/public_ip/create", post(create_public_ip))
        .route(
            "/api/dev/cluster/create_from_all_machines_in_inventory",
            post(dev_create_cluster_from_all_machines_in_inventory),
        )
        .route(
            "/api/dev/cluster/install_basics",
            post(dev_install_cluster_basics),
        )
        .route("/api/terminal/direct/:id", get(direct_terminal))
        .route("/v1/boot/:mac_addr", get(get_boot_config_by_mac))
        .nest_service("/", serve_dir)
        .layer(
            CorsLayer::new()
                .allow_origin(
                    origins
                        .iter()
                        .map(|x| {
                            HeaderValue::from_str(x.origin().ascii_serialization().as_str())
                                .unwrap()
                        })
                        .collect::<Vec<HeaderValue>>(),
                )
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([CONTENT_TYPE, UPGRADE]),
        );

    info!("Open {} in your browser", ic.primary_origin);

    start_background_tasks().await?;

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, 3000)).await?;

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Failed to start server")?;

    Ok(())
}
