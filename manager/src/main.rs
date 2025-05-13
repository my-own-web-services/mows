use anyhow::Context;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{HeaderValue, Method};
use manager::api::boot::*;

use manager::api::direct_terminal::*;
use manager::api::public_ip::*;
use manager::internal_config::INTERNAL_CONFIG;
use manager::tasks::start_background_tasks;
use manager::tracing::start_tracing;
use manager::ui::serve_spa;
use manager::utils::{shutdown_signal, start_dnsmasq, start_pixiecore};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use utoipa_swagger_ui::SwaggerUi;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "mows-manager", description = "Cluster management API")
    )
)]
pub struct ApiDoc;

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let ic = &INTERNAL_CONFIG;

    start_tracing().await.context("Failed to start tracing!")?;

    start_pixiecore()
        .await
        .context("Failed to start Pixiecore")?;

    start_dnsmasq().await.context("Failed to start Dnsmasq")?;

    let mut origins = vec![&ic.primary_origin];

    if ic.dev.enabled {
        let _ = &ic.dev.allow_origins.iter().for_each(|x| origins.push(x));
    }

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        //.nest("/api/machines", machines::router())
        // machines
        .routes(routes!(manager::api::machines::delete_machine))
        .routes(routes!(manager::api::machines::create_machines))
        .routes(routes!(manager::api::machines::signal_machine))
        .routes(routes!(manager::api::machines::get_machine_info))
        .routes(routes!(manager::api::machines::get_vnc_websocket))
        .routes(routes!(manager::api::machines::get_machine_status))
        .routes(routes!(manager::api::machines::dev_delete_all_machines))
        // cluster
        .routes(routes!(
            manager::api::clusters::dev_create_cluster_from_all_machines_in_inventory
        ))
        .routes(routes!(manager::api::clusters::dev_install_cluster_basics))
        .routes(routes!(manager::api::clusters::get_cluster_status))
        .routes(routes!(manager::api::clusters::signal_cluster))
        // health
        .routes(routes!(manager::api::health::get_health))
        // config
        .routes(routes!(manager::api::config::update_config))
        .routes(routes!(manager::api::config::get_config))
        //.nest("/api/config", config_api::router())
        //.nest("/api/health", health::router())
        //.nest("/api/clusters", clusters::router())
        .routes(routes!(create_public_ip))
        .routes(routes!(get_boot_config_by_mac))
        .routes(routes!(direct_terminal))
        .fallback(serve_spa)
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
