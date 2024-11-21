use anyhow::Context;
use axum::http::{
    header::{CONTENT_TYPE, UPGRADE},
    HeaderValue, Method,
};
use mows_common::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use package_manager::{api::health::health, config::config, utils::shutdown_signal};
use std::net::SocketAddr;
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};
use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "mows-package-manager", description = "MOWS Package Manager API"),
    )
)]
struct ApiDoc;

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let config = get_current_config_cloned!(config());
    let _common_config = get_current_config_cloned!(common_config());

    init_observability().await;

    let serve_dir = ServeDir::new("ui").not_found_service(ServeFile::new("ui/index.html"));

    let mut origins = vec![&config.primary_origin];

    if config.enable_dev {
        let _ = &config
            .dev_allow_origins
            .iter()
            .for_each(|origin| origins.push(origin));
    }

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest("/api/health", health::router())
        .nest_service("/", serve_dir)
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
