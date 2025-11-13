use mows_common_rust::observability::init_observability;
use pektin_api::get_current_config_cloned;
use pektin_api::vault::create_vault_client_with_k8s_login;
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use actix_cors::Cors;
use actix_web::{http, web, App, HttpServer};
use anyhow::bail;
use chrono::Duration;
use pektin_api::config;
use pektin_api::signing_task::signing_task;
use tokio::signal::unix::{signal, SignalKind};
use tracing::{debug, info};

use pektin_api::delete::delete;
use pektin_api::errors_and_responses::json_error_handler;
use pektin_api::get::get;
use pektin_api::get_zone_records::get_zone_records;
use pektin_api::health::health;
use pektin_api::search::search;
use pektin_api::set::set;
use pektin_api::types::AppState;
use pektin_common::deadpool_redis;
use pektin_common::deadpool_redis::redis::Client;
use tracing_actix_web::TracingLogger;

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    init_observability().await;

    debug!("Loading config...");
    let config = get_current_config_cloned!();
    debug!("Config loaded successfully.\n");

    // the db pool needs to be created in the HttpServer::new closure because of trait bounds.
    // in there, we cannot use the ? operator. to notify the user about a potentially invalid db
    // uri in a nice way (i.e. not via .expect()), we create a client here that checks the uri
    let db_uri = format!(
        "redis://{}:{}@{}:{}/0",
        config.db_username, config.db_password, config.db_hostname, config.db_port
    );
    debug!("Connecting to db at {}", db_uri);

    // check if connection with vault works
    loop {
        match create_vault_client_with_k8s_login().await {
            Ok((_, managed_client)) => {
                // Successfully connected to vault, revoke the test token
                if let Err(e) = managed_client.revoke_token().await {
                    tracing::warn!("Failed to revoke test vault token: {}", e);
                }
                break;
            }
            Err(e) => {
                tracing::error!(
                    "Failed to create vault client, retrying in 5 seconds: {:?}",
                    e
                );
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    }

    let db_uri_dnssec = format!(
        "redis://{}:{}@{}:{}/1",
        config.db_username, config.db_password, config.db_hostname, config.db_port
    );
    debug!("Connecting to db for dnssec at {}", db_uri_dnssec);

    let db_connection_info = if let Ok(client) = Client::open(db_uri) {
        client.get_connection_info().clone()
    } else {
        bail!("Invalid db URI")
    };

    let db_connection_dnssec_info = if let Ok(client) = Client::open(db_uri_dnssec) {
        client.get_connection_info().clone()
    } else {
        bail!("Invalid db URI")
    };

    let db_pool_conf = deadpool_redis::Config {
        url: None,
        connection: Some(db_connection_info.into()),
        pool: None,
    };

    let db_pool_dnssec_conf = deadpool_redis::Config {
        url: None,
        connection: Some(db_connection_dnssec_info.into()),
        pool: None,
    };

    let bind_addr = format!("{}:{}", &config.bind_address, &config.bind_port);
    info!("Binding to {}", bind_addr);

    let db_pool = db_pool_conf
        .create_pool(Some(deadpool_redis::Runtime::Tokio1))
        .expect("Failed to create db connection pool");
    let db_pool_dnssec = db_pool_dnssec_conf
        .create_pool(Some(deadpool_redis::Runtime::Tokio1))
        .expect("Failed to create db connection pool for dnssec");

    // check if we can connect to the db
    let mut con = db_pool.get().await?;
    let _: () = deadpool_redis::redis::cmd("PING")
        .query_async(&mut con)
        .await?;

    let state = AppState {
        db_pool,
        db_pool_dnssec,
        ribston_uri: config.ribston_uri.clone(),
        skip_auth: config.skip_auth.clone(),
        vault_client: create_vault_client_with_k8s_login().await?.1,
    };

    info!("Starting server...");

    let http_server_state = state.clone();
    let http_server = HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::default())
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allowed_headers(vec![
                        http::header::CONTENT_TYPE,
                        http::header::AUTHORIZATION,
                    ])
                    .allowed_methods(vec!["POST"])
                    .max_age(86400),
            )
            .app_data(
                web::JsonConfig::default()
                    .error_handler(json_error_handler)
                    .content_type(|mime| mime == mime::APPLICATION_JSON),
            )
            .app_data(web::Data::new(http_server_state.clone()))
            .service(get)
            .service(get_zone_records)
            .service(set)
            .service(delete)
            .service(search)
            .service(health)
    })
    .bind(bind_addr)?
    .run();

    info!("Server started");

    info!("Starting signing task...");
    // TODO: make this configurable, e.g. via env var
    let signing_task = signing_task(state, Duration::minutes(15), Duration::hours(2));

    info!("Signing task started");

    // shutdown if we receive a SIGINT (Ctrl+C) or SIGTERM (sent by docker on shutdown)
    let mut sigint = signal(SignalKind::interrupt())?;
    let mut sigterm = signal(SignalKind::terminate())?;

    tokio::select! {
        res = http_server => res.map_err(Into::into),
        _ = signing_task => Ok(()),
        _ = sigint.recv() => Ok(()),
        _ = sigterm.recv() => Ok(()),
    }
}
