use anyhow::Context;
use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE, UPGRADE},
    HeaderValue, Method,
};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use server::{api::files, config::config, utils::shutdown_signal};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use utoipa_axum::routes;

use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;
use zitadel::axum::introspection::IntrospectionStateBuilder;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "filez-server", description = "MOWS Filez API"),
    )
)]
struct ApiDoc;

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let config = get_current_config_cloned!(config());
    let _common_config = get_current_config_cloned!(common_config(true));
    init_observability().await;

    let mut origins = vec![&config.primary_origin];
    if config.enable_dev {
        let _ = &config
            .dev_allow_origins
            .iter()
            .for_each(|origin| origins.push(origin));
    }

    let introspection_state = IntrospectionStateBuilder::new(&config.oidc_issuer.clone())
        .with_basic_auth(
            &config.oidc_client_id.clone(),
            &config.oidc_client_secret.clone(),
        )
        .build()
        .await
        .context("Failed to create introspection state")?;

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(crate::files::get::get_file))
        .with_state(introspection_state)
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
                .allow_headers([CONTENT_TYPE, UPGRADE, AUTHORIZATION]),
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
