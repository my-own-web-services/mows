use anyhow::Context;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{HeaderValue, Method};
use manager::api::openapi::build_api_router;
use manager::internal_config::INTERNAL_CONFIG;
use manager::tasks::start_background_tasks;
use manager::tracing::start_tracing;
use manager::ui::serve_spa;
use manager::utils::{shutdown_signal, start_dnsmasq, start_pixiecore};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing::info;

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

    let (router, api) = build_api_router()
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

    let router = router.merge(
        utoipa_swagger_ui::SwaggerUi::new("/swagger-ui")
            .config(utoipa_swagger_ui::Config::default().validator_url("none"))
            .url("/api-docs/openapi.json", api),
    );

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
