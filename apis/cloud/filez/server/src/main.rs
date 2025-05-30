use anyhow::Context;
use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE, UPGRADE},
    HeaderValue, Method,
};
use diesel_async::AsyncPgConnection;
use diesel_async::{async_connection_wrapper::AsyncConnectionWrapper, RunQueryDsl};
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncConnection,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use server::{api::files, config::config, db::Db, types::AppState, utils::shutdown_signal};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use utoipa_axum::routes;

use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;
use zitadel::axum::introspection::IntrospectionStateBuilder;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

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

    {
        // run pending migrations

        let async_connection = AsyncPgConnection::establish(&config.db_url).await?;

        let mut async_wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
            AsyncConnectionWrapper::from(async_connection);

        tokio::task::spawn_blocking(move || {
            async_wrapper.run_pending_migrations(MIGRATIONS).unwrap();
        })
        .await?;
    }

    let connection_manager =
        AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(config.db_url.clone());
    let pool = Pool::builder(connection_manager).build()?;
    let db = Db::new(pool).await;

    let app_state = AppState {
        db: db.clone(),
        user: introspection_state,
    };

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(crate::files::get_content::get_file_content))
        .routes(routes!(crate::files::get_metadata::get_files_metadata))
        .with_state(app_state)
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
        .layer(axum_server_timing::ServerTimingLayer::new("FilezService"))
        .split_for_parts();

    let router = router.merge(SwaggerUi::new("/swagger-ui").url("/apidoc/openapi.json", api));

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, 8080)).await?;

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Failed to start server")?;

    Ok(())
}
