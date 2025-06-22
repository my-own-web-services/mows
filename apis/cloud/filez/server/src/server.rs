use anyhow::Context;
use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE, UPGRADE},
    HeaderName, HeaderValue, Method,
};
use axum_health::{health, Health};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
use diesel_async::AsyncPgConnection;
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncConnection,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use minio::s3::{creds::StaticProvider, http::BaseUrl, ClientBuilder};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use server::{
    api::{self},
    config::{config, BUCKET_NAME},
    db::Db,
    types::{ApiDoc, AppState},
    utils::{
        create_bucket_if_not_exists, shutdown_signal, MinioHealthIndicator,
        PostgresHealthIndicator, ZitadelHealthIndicator,
    },
};
use std::{net::SocketAddr, str::FromStr};
use tower_http::{
    compression::CompressionLayer, cors::CorsLayer, decompression::DecompressionLayer,
};
use utoipa::OpenApi;
use utoipa_axum::routes;

use axum::routing::get;
use tracing::{info, warn};
use utoipa_axum::router::OpenApiRouter;
use utoipa_swagger_ui::SwaggerUi;
use zitadel::{
    axum::introspection::IntrospectionStateBuilder,
    oidc::introspection::cache::in_memory::InMemoryIntrospectionCache,
};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

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
        .with_introspection_cache(InMemoryIntrospectionCache::new())
        .build()
        .await
        .context("Failed to create introspection state")?;

    // run pending migrations

    match AsyncPgConnection::establish(&config.db_url)
        .await
        .context("Failed to establish async Postgres connection")
    {
        Ok(async_connection) => {
            let mut async_wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
                AsyncConnectionWrapper::from(async_connection);

            tokio::task::spawn_blocking(move || {
                async_wrapper.run_pending_migrations(MIGRATIONS).unwrap();
            })
            .await
            .context("Failed to run pending migrations")?;
        }
        Err(e) => {
            tracing::error!("Failed to establish async Postgres connection: {e}");
        }
    };

    // create the postgres connection pool
    let connection_manager =
        AsyncDieselConnectionManager::<diesel_async::AsyncPgConnection>::new(config.db_url.clone());
    let pool = Pool::builder(connection_manager)
        .build()
        .context("Failed to create Postgres connection pool")?;
    let db = Db::new(pool).await;

    // create the minio client
    let minio_static_provider =
        StaticProvider::new(&config.minio_username, &config.minio_password, None);
    let minio_client = ClientBuilder::new(
        BaseUrl::from_str(&config.minio_endpoint).context("Failed to parse MinIO endpoint URL.")?,
    )
    .provider(Some(Box::new(minio_static_provider)))
    .build()
    .context("Failed to create MinIO client.")?;

    // create the bucket if it does not exist in the background
    let background_client = minio_client.clone();
    tokio::spawn(async move {
        info!("Creating bucket if it does not exist: {BUCKET_NAME}");

        loop {
            if let Err(e) = create_bucket_if_not_exists(BUCKET_NAME, &background_client).await {
                warn!("Failed to create bucket: {e}, retrying in 5 seconds...");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            } else {
                info!("Bucket created successfully");
                break;
            }
        }
    });

    let app_state = AppState {
        db: db.clone(),
        minio_client: minio_client.clone(),
        introspection_state: introspection_state.clone(),
    };

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
        .routes(routes!(api::file_groups::list_items::list_files))
        // USERS
        .routes(routes!(api::users::apply::apply_user))
        .routes(routes!(api::users::get::get_users))
        // AUTH
        .routes(routes!(
            api::auth::check_resource_access::check_resource_access
        ))
        .route("/api/health", get(health))
        .layer(
            Health::builder()
                .with_indicator(MinioHealthIndicator::new(
                    "minio".to_string(),
                    minio_client.clone(),
                ))
                .with_indicator(PostgresHealthIndicator::new(
                    "postgres".to_string(),
                    db.clone(),
                ))
                .with_indicator(ZitadelHealthIndicator::new(
                    "zitadel".to_string(),
                    introspection_state,
                ))
                .build(),
        )
        .with_state(app_state)
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
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([
                    CONTENT_TYPE,
                    UPGRADE,
                    AUTHORIZATION,
                    HeaderName::from_static("x-filez-metadata"),
                ]),
        )
        .layer(axum_server_timing::ServerTimingLayer::new("FilezService"))
        .split_for_parts();

    let router = router.merge(SwaggerUi::new("/swagger-ui").url("/apidoc/openapi.json", api));

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, 8080))
        .await
        .context("Failed to bind TCP listener to address ::1:8080")?;

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Failed to start server")?;

    Ok(())
}
