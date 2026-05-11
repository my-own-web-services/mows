use anyhow::Context;
use axum::http::{
    header::{CONTENT_TYPE, UPGRADE},
    HeaderValue, Method,
};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use mows_package_manager::{
    api::openapi::build_api_router, config::config, ui::serve_spa, utils::shutdown_signal,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing::info;
use utoipa_swagger_ui::SwaggerUi;

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let config = get_current_config_cloned!(config());
    let _common_config = get_current_config_cloned!(common_config(true));

    init_observability().await;

    //dbg!(MowsManifest::example_yaml_str());

    let mut origins = vec![&config.primary_origin];
    if config.enable_dev {
        let _ = &config
            .dev_allow_origins
            .iter()
            .for_each(|origin| origins.push(origin));
    }

    let (router, api) = build_api_router()
        .fallback(serve_spa)
        .layer(
            CorsLayer::new()
                .allow_origin(
                    origins
                        .iter()
                        .map(|origin| {
                            HeaderValue::from_str(origin.origin().ascii_serialization().as_str())
                                .unwrap()
                        })
                        .collect::<Vec<HeaderValue>>(),
                )
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([CONTENT_TYPE, UPGRADE]),
        )
        .split_for_parts();

    let router = router.merge(SwaggerUi::new("/swagger-ui").url("/apidoc/openapi.json", api));

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, 80)).await?;

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Failed to start server")?;

    Ok(())
}
