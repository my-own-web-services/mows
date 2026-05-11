use anyhow::Context;
use axum::http::{
    header::{AUTHORIZATION, CONTENT_SECURITY_POLICY, CONTENT_TYPE},
    request::Parts,
    HeaderValue, Method,
};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use filez_server_lib::{
    api_router::build_api_router,
    background_tasks::run_background_tasks,
    config::{config, IMPERSONATE_USER_HEADER_NAME},
    database::Database,
    http_api::authentication::middleware::authentication_middleware,
    kubernetes_controller,
    models::apps::MowsApp,
    state::ServerState,
    utils::{shutdown_signal, static_as_header},
};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    decompression::DecompressionLayer,
    set_header::SetResponseHeaderLayer,
};
use tower_sessions::{cookie::time::Duration, Expiry, MemoryStore, SessionManagerLayer};
use tracing::error;
use tracing::info;

#[tracing::instrument(level = "trace")]
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
    match Database::run_migrations().await {
        Ok(_) => info!("Migrations completed successfully"),
        Err(e) => {
            error!("Failed to run migrations: {e}");
        }
    }

    let server_state = ServerState::new(&config)
        .await
        .context("Failed to create server state")?;

    let database_for_cors_layer = server_state.database.clone();

    let session_storage_adapter = MemoryStore::default();

    let (router, api) = build_api_router()
        .with_state(server_state.clone())
        .layer(
            ServiceBuilder::new()
                .layer(
                    SessionManagerLayer::new(session_storage_adapter)
                        .with_secure(true)
                        .with_http_only(true)
                        .with_same_site(tower_sessions::cookie::SameSite::None)
                        .with_expiry(Expiry::OnInactivity(Duration::seconds(
                            config.session_timeout_on_inactivity_seconds,
                        ))),
                )
                .layer(OtelAxumLayer::default())
                .layer(OtelInResponseLayer::default())
                .layer(axum::middleware::from_fn(
                    filez_server_lib::trace::traceparent_middleware,
                ))
                .layer(axum_server_timing::ServerTimingLayer::new("FilezService"))
                .layer(CompressionLayer::new())
                .layer(DecompressionLayer::new())
                .layer(
                    CorsLayer::new()
                        .allow_origin(AllowOrigin::async_predicate(
                            move |origin: HeaderValue, _: &Parts| async move {
                                let origin = match origin.to_str() {
                                    Ok(s) => s,
                                    Err(_) => return false,
                                };
                                if let Ok(_) = MowsApp::get_from_origin_string(
                                    &database_for_cors_layer,
                                    &origin,
                                )
                                .await
                                {
                                    return true;
                                } else {
                                    return false;
                                }
                            },
                        ))
                        .allow_methods([
                            Method::GET,
                            Method::POST,
                            Method::PUT,
                            Method::DELETE,
                            Method::PATCH,
                            Method::HEAD,
                        ])
                        .allow_credentials(true)
                        .allow_headers([
                            AUTHORIZATION,
                            CONTENT_TYPE,
                            static_as_header(IMPERSONATE_USER_HEADER_NAME),
                        ]),
                )
                .layer(SetResponseHeaderLayer::overriding(
                    CONTENT_SECURITY_POLICY,
                    HeaderValue::from_static("default-src 'none'"),
                ))
                .layer(axum::middleware::from_fn_with_state(
                    server_state.clone(),
                    authentication_middleware,
                )),
        )
        .split_for_parts();

    let router = router.merge(
        utoipa_swagger_ui::SwaggerUi::new("/swagger-ui")
            .config(utoipa_swagger_ui::Config::default().validator_url("none"))
            .url("/api-docs/openapi.json", api),
    );

    info!("Starting server");

    let listener =
        tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, config.listen_port))
            .await
            .context("Failed to bind TCP listener to address ::1:8080")?;

    let controller = kubernetes_controller::run_controller(server_state.clone());

    let server = axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal());

    run_background_tasks(&server_state);

    tokio::join!(controller, server).1?;

    Ok(())
}
