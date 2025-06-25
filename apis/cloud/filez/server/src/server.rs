use anyhow::Context;
use axum::http::HeaderValue;
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use server_lib::{
    api::{self},
    config::config,
    controller,
    db::Db,
    state::ServerState,
    types::ApiDoc,
    utils::shutdown_signal,
};
use std::net::SocketAddr;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    decompression::DecompressionLayer,
};
use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use utoipa_swagger_ui::SwaggerUi;

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

    // run pending migrations
    Db::run_migrations(&config)
        .await
        .context("Failed to run migrations")?;

    // create the bucket if it does not exist in the background

    let server_state = ServerState::new(&config)
        .await
        .context("Failed to create server state")?;

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        // NOTE!
        // Sometimes when something is wrong with the extractors a warning will appear of an axum version mismatch.
        // THIS IS NOT THE REASON why the error occurs.
        // often it is the order of the extractors in the route handlers
        // FILES
        .routes(routes!(api::files::get::get_file_content))
        .routes(routes!(api::files::create::create_file))
        .routes(routes!(api::files::meta::get::get_files_metadata))
        .routes(routes!(api::files::meta::update::update_files_metadata))
        // FILE GROUPS
        .routes(routes!(api::file_groups::list_files::list_files))
        // USERS
        .routes(routes!(api::users::apply::apply_user))
        .routes(routes!(api::users::get::get_users))
        // AUTH
        .routes(routes!(
            api::auth::check_resource_access::check_resource_access
        ))
        // HEALTH
        .routes(routes!(api::health::get_health))
        .with_state(server_state.clone())
        .layer(CompressionLayer::new())
        .layer(DecompressionLayer::new())
        .layer(OtelInResponseLayer::default())
        .layer(OtelAxumLayer::default())
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
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(axum_server_timing::ServerTimingLayer::new("FilezService"))
        .split_for_parts();

    let router = router.merge(SwaggerUi::new("/swagger-ui").url("/apidoc/openapi.json", api));

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, 8080))
        .await
        .context("Failed to bind TCP listener to address ::1:8080")?;

    let controller = controller::run(server_state.clone());

    let server = axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal());

    tokio::join!(controller, server).1?;

    Ok(())
}
