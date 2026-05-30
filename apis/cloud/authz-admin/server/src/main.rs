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
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    decompression::DecompressionLayer,
    trace::TraceLayer,
};
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

    let registry = Registry::from_config(&cfg)
        .context("validating upstream URLs at boot")?;
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

    // tower layers:
    //   * TraceLayer    — structured per-request spans (latency,
    //                     status, method, path). The
    //                     tracing_subscriber init above renders
    //                     them to stdout.
    //   * CORS          — admin UI runs on a different origin
    //                     than the BFF in production. Mirror
    //                     the request Origin so a per-tenant
    //                     subdomain works without an explicit
    //                     allowlist. **No `allow_credentials`**:
    //                     the BFF carries no cookies of its own
    //                     and the SPA sends `fetch` without
    //                     `credentials: "include"` — adding
    //                     credentials here would tell the
    //                     browser "this response is safe for
    //                     ANY origin to read with credentials,"
    //                     which is the classic Origin-reflection
    //                     vuln. (review-3 R1 / SEC-1)
    //   * Compression   — both directions; admin responses can
    //                     be JSON payloads of tens of KB once
    //                     filez's full visible set is in flight.
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_headers(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any);
    let axum_router = axum_router
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(DecompressionLayer::new())
        .layer(cors);

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
