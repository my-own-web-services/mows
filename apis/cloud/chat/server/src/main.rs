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
    api_router::build_api_router,
    config::{config, init_config},
    database::Database,
    state::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_target(true)
        .init();

    // Load env-var-driven config FIRST so a parse failure is a
    // clean ExitCode 1 instead of a panic deep inside the first
    // config() access. See review A6.
    init_config().context("failed to load chat-server config from env")?;
    let config = get_current_config_cloned!(config());
    info!(
        listen_port = config.listen_port,
        "chat-server starting"
    );

    Database::run_migrations()
        .await
        .context("running pending migrations on boot")?;
    info!("migrations applied");

    let state = AppState::new(&config.db_url).await?;
    info!(context_app_id = %state.context_app.id, "chat MowsApp bootstrapped");

    let router = build_api_router().with_state(state.clone());
    let (axum_router, _openapi) = OpenApiRouter::split_for_parts(router);
    // Attach auth middleware after the OpenAPI split so the
    // middleware applies to every route, not just the ones
    // documented by utoipa.
    let axum_router = axum_router.layer(axum::middleware::from_fn_with_state(
        state.clone(),
        chat_server_lib::http_api::authentication::middleware::authentication_middleware,
    ));
    // Static demo client. Mounted at `/demo/` only when
    // `enable_dev = true`; gated so a prod deployment that
    // happens to have the demo folder present (e.g. a misbuilt
    // image) doesn't accidentally expose it.
    // `tower_http::services::ServeDir` normalises `..` segments
    // and refuses to serve files outside the root by design (see
    // tower-http SECURITY.md), so the mount is path-traversal-safe
    // by construction; an explicit 404 on `/demo/../etc/passwd` is
    // exercised in `tests/end_to_end.rs::demo_path_traversal_404`
    // (review A17 / SLOP-8).
    let demo_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("demo");
    let axum_router = if config.enable_dev && demo_path.exists() {
        info!("serving demo client at /demo/ from {}", demo_path.display());
        axum_router.nest_service("/demo", tower_http::services::ServeDir::new(demo_path))
    } else {
        axum_router
    };

    let bind = format!("{}:{}", config.bind_address, config.listen_port);
    // Production-safety guard (review A1): the dev-only ?user=
    // query-string auth fallback must not be reachable from
    // non-localhost addresses. If an operator combines the two,
    // refuse to boot.
    if config.enable_dev_user_query_auth
        && !is_localhost_bind(&config.bind_address)
    {
        anyhow::bail!(
            "refusing to start: ENABLE_DEV_USER_QUERY_AUTH=true requires BIND_ADDRESS \
             to be a localhost-only address (127.0.0.1 / ::1), got {bind}"
        );
    }
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .with_context(|| format!("binding TCP listener on {bind}"))?;
    info!("listening on {bind}");
    axum::serve(listener, axum_router)
        .await
        .context("axum::serve exited unexpectedly")?;

    Ok(())
}

/// True iff the configured bind address only accepts connections
/// from localhost. Used to refuse to start when the dev-only
/// `?user=<uuid>` WebSocket auth fallback is enabled — see
/// review A1 (SLOP-2 / TASTE-7).
fn is_localhost_bind(bind_address: &str) -> bool {
    matches!(bind_address, "127.0.0.1" | "::1" | "localhost")
}
