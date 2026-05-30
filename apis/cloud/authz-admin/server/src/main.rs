//! authz-admin entry point.
//!
//! Cross-service authorization admin BFF (Phase 7 of the
//! authorization initiative). Aggregates `/api/access_policies/*`
//! across consumer services (realtime, filez, …) so a single
//! operator UI can answer "who can see what + why" without a
//! per-service tab. The BFF holds no DB; it's a typed reqwest
//! façade on top of upstream APIs.
//!
//! See `.plans/authorization/PLAN.md` §"Phase 7" for scope.

use anyhow::Context;
use mows_common_rust::get_current_config_cloned;
use tracing::info;
use tracing_subscriber::EnvFilter;
use utoipa_axum::router::OpenApiRouter;

use authz_admin_server_lib::{
    api_router::build_api_router,
    config::{config, init_config},
    state::AppState,
    upstream::Registry,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(true)
        .init();

    init_config().context("loading authz-admin config from env")?;
    let cfg = get_current_config_cloned!(config());
    info!(listen_port = cfg.listen_port, "authz-admin starting");

    let registry = Registry::from_config(&cfg);
    if registry.upstreams.is_empty() {
        // A BFF with zero upstreams is a misconfigured deploy —
        // it would only return empty aggregations. Refuse to
        // start so an operator notices immediately.
        anyhow::bail!(
            "no upstreams configured. Set REALTIME_BASE_URL and/or FILEZ_BASE_URL."
        );
    }
    for up in &registry.upstreams {
        info!(upstream = up.key, base_url = up.base_url, "upstream registered");
    }

    let state = AppState::new(registry)?;
    let router = build_api_router().with_state(state);
    let (axum_router, _openapi) = OpenApiRouter::split_for_parts(router);

    let bind = format!("{}:{}", cfg.bind_address, cfg.listen_port);
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .with_context(|| format!("binding TCP listener on {bind}"))?;
    info!("listening on {bind}");
    axum::serve(listener, axum_router)
        .await
        .context("axum::serve exited unexpectedly")?;

    Ok(())
}
