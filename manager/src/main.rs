use anyhow::Context;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{HeaderValue, Method};
use manager::api::boot::*;
use manager::api::cluster::*;
use manager::api::config::*;
use manager::api::direct_terminal::*;
use manager::api::machines::*;
use manager::api::public_ip::*;
use manager::config::*;
use manager::internal_config::INTERNAL_CONFIG;
use manager::machines::*;
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
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use utoipa_swagger_ui::SwaggerUi;

/*
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;
#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;
*/

#[derive(utoipa::OpenApi)]
#[openapi(
    components(
        schemas(
            ApiResponseStatus,
            ApiResponse<EmptyApiResponse>,
            ApiResponse<MachineInfoResBody>,
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
            MachineStatusResBody,
            PublicIpCreationConfig,
            PublicIpCreationConfigType,
            MachineStatus,
            VncWebsocket,
        )
    ),
    tags(
        (name = "mows-manager", description = "Cluster management API")
    )
)]
struct ApiDoc;

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
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

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(
            update_config,
            get_config,
            create_machines,
            signal_machine,
            delete_machine,
            get_machine_info,
            get_machine_status,
            get_vnc_websocket,
            dev_delete_all_machines,
            create_public_ip,
            dev_create_cluster_from_all_machines_in_inventory,
            get_boot_config_by_mac,
            direct_terminal
        ))
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
        )
        .split_for_parts();

    let router = router.merge(SwaggerUi::new("/swagger-ui").url("/apidoc/openapi.json", api));

    info!("Open {} in your browser", ic.primary_origin);

    start_background_tasks().await?;

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, 3000)).await?;

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Failed to start server")?;

    Ok(())
}
