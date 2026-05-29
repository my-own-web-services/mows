//! chat-server entry point.
//!
//! Round 1 surface: bind axum, expose `/api/health`, apply
//! migrations on boot. Real auth + the channels endpoints land in
//! Round 2 and Round 3 per `.plans/chat-service/PLAN.md`.

use anyhow::Context;
use mows_common_rust::get_current_config_cloned;
use tracing::info;
use tracing_subscriber::EnvFilter;
use utoipa_axum::router::OpenApiRouter;

use chat_server_lib::{
    api_router::build_api_router, config::config, database::Database, state::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_target(true)
        .init();

    let config = get_current_config_cloned!(config());
    info!(
        listen_port = config.listen_port,
        "chat-server starting"
    );

    Database::run_migrations()
        .await
        .context("running pending migrations on boot")?;
    info!("migrations applied");

    let state = AppState::new(&config.db_url).await;

    let router = build_api_router().with_state(state);
    let (axum_router, _openapi) = OpenApiRouter::split_for_parts(router);

    let bind = format!("0.0.0.0:{}", config.listen_port);
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .with_context(|| format!("binding TCP listener on {bind}"))?;
    info!("listening on {bind}");
    axum::serve(listener, axum_router)
        .await
        .context("axum::serve exited unexpectedly")?;

    Ok(())
}
