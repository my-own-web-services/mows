//! HTTP + unix-socket API.
//!
//! Two listeners are exposed:
//! - **Unix socket** at `config.unix_socket` — local trust domain, no auth
//!   required (process uid is enough). Used by the CLI when running on the
//!   same host as the supervisor.
//! - **Loopback HTTP** at `config.http_listen` — every `/v1/*` route except
//!   `POST /v1/auth/login`, `GET /v1/healthz`, and the SPA fallback requires
//!   `Authorization: Bearer <token>`. The token either matches the
//!   configured `MOWS_VM_SUPERVISOR_API_TOKEN[_FILE]` or resolves to a
//!   valid row in the `sessions` table.
//!
//! REST routes participate in OpenAPI generation (utoipa-axum). Websocket
//! upgrades and the SPA fallback stay on a plain `axum::Router` and are
//! merged on top — they don't model in OpenAPI.
//!
//! HTTPS on the WireGuard interface is planned but not wired in v1.
//!
//! # API versioning policy (FUTURE-13)
//!
//! Every REST route is mounted under `/v1/`. The contract:
//! - **Additive changes** (new field on a response, new endpoint, new
//!   optional request field) ship under the same `/v1/` prefix. Clients
//!   that ignore unknown fields keep working.
//! - **Breaking changes** (renamed/removed fields, semantic shifts that
//!   could surprise an existing client) get a new prefix (`/v2/`). The
//!   old prefix continues to serve the old shape for a deprecation
//!   window of at least one release cycle.
//! - WebSocket upgrades (`/v1/vms/{id}/{display,console}`,
//!   `/v1/agents/{id}/io`) follow the same convention — bump the
//!   prefix when the framing/message contract changes, never repurpose
//!   a path silently.
//!
//! Clients should send `Accept: application/json` and SHOULD NOT
//! depend on key ordering. The OpenAPI document served at
//! `/openapi.json` is the canonical schema for the live server.

use std::os::unix::fs::PermissionsExt;
use std::sync::Arc;

use axum::Router;
use tokio::net::UnixListener;
use tower_governor::governor::GovernorConfigBuilder;
use tower_governor::GovernorLayer;
use tower_http::compression::CompressionLayer;
use tower_http::decompression::DecompressionLayer;
use tower_http::trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer};
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;

use crate::error::Result;
use crate::state::SharedState;

mod agents;
mod auth;
mod auth_middleware;
mod health;
pub(crate) mod types;
mod users;
mod validation;
mod vms;
mod web;

pub use auth_middleware::AuthContext;

#[derive(OpenApi)]
#[openapi(
    tags(
        (name = "health", description = "Liveness probes"),
        (name = "auth",   description = "Authentication / session tokens"),
        (name = "vms",    description = "VM lifecycle"),
        (name = "agents", description = "Agent lifecycle inside a VM"),
        (name = "users",  description = "Supervisor user management"),
    ),
    info(
        title = env!("CARGO_PKG_NAME"),
        description = "REST API for mows-vm-supervisor.",
        version = env!("CARGO_PKG_VERSION"),
    ),
    components(schemas(
        types::ErrorResponse,
        types::OperationResult,
        auth::LoginRequest,
        auth::LoginResponse,
        health::HealthResponse,
        users::CreateUserRequest,
        users::UserSummary,
        vms::CreateVmRequest,
        vms::UpdateVmRequest,
        vms::VmSummary,
        vms::VmDefaultsResponse,
        vms::VmSshInfo,
        vms::VmImage,
        vms::VmDisplayMode,
        vms::VmStatus,
        agents::CreateAgentRequest,
        agents::UpdateAgentRequest,
        agents::AgentSummary,
    )),
)]
pub struct SupervisorApiDoc;

/// REST routes that do NOT require auth: liveness + login + (no) static SPA.
fn unauthenticated_rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new()
        .merge(health::rest_router())
        .merge(auth::rest_router())
}

/// Per-IP rate limit configuration for `/v1/auth/login`. Five attempts per
/// minute (1 every 12 seconds with bursts up to 5). Excess requests return
/// 429 with `Retry-After`. Built once and reused across all callers.
fn login_governor_config() -> Arc<
    tower_governor::governor::GovernorConfig<
        tower_governor::key_extractor::PeerIpKeyExtractor,
        governor::middleware::NoOpMiddleware,
    >,
> {
    Arc::new(
        GovernorConfigBuilder::default()
            .per_second(12)
            .burst_size(5)
            .finish()
            .expect("login governor config is statically valid"),
    )
}

/// REST routes that require auth on the TCP listener.
fn authenticated_rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new()
        .merge(vms::rest_router())
        .merge(agents::rest_router())
        .merge(users::rest_router())
}

/// Full `OpenApiRouter<SharedState>` carrying every REST route. Used by the
/// build-time `openapi_dump` binary so the published spec includes
/// everything (auth requirements are documented separately).
pub fn build_api_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::with_openapi(SupervisorApiDoc::openapi())
        .merge(unauthenticated_rest_router())
        .merge(authenticated_rest_router())
}

/// Cross-cutting middleware applied to every listener: structured request
/// tracing and tower-http compression/decompression (gzip, brotli, deflate,
/// zstd — all enabled via the `compression-full`/`decompression-full`
/// features in `Cargo.toml`).
fn global_middleware() -> tower::layer::util::Stack<
    DecompressionLayer,
    tower::layer::util::Stack<
        CompressionLayer,
        tower::layer::util::Stack<
            TraceLayer<
                tower_http::classify::SharedClassifier<tower_http::classify::ServerErrorsAsFailures>,
                DefaultMakeSpan,
                (),
                DefaultOnResponse,
            >,
            tower::layer::util::Identity,
        >,
    >,
> {
    tower::ServiceBuilder::new()
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(tracing::Level::INFO))
                .on_request(())
                .on_response(DefaultOnResponse::new().level(tracing::Level::INFO)),
        )
        .layer(CompressionLayer::new())
        .layer(DecompressionLayer::new())
        .into_inner()
}

/// Build the router served on the loopback HTTP listener. Protected routes
/// are wrapped in the bearer-token middleware; unauthenticated routes
/// (login, healthz, SPA fallback) are merged on top.
fn http_router(state: SharedState) -> Router {
    let (auth_required_rest, _) = OpenApiRouter::with_openapi(SupervisorApiDoc::openapi())
        .merge(authenticated_rest_router())
        .split_for_parts();

    let protected = auth_required_rest
        .merge(vms::ws_router())
        .merge(agents::ws_router())
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::require_auth,
        ));

    // Login is rate-limited per source IP; health + SPA stay unlimited.
    let (health_only, _) = OpenApiRouter::with_openapi(SupervisorApiDoc::openapi())
        .merge(health::rest_router())
        .split_for_parts();
    let (auth_only, _) = OpenApiRouter::with_openapi(SupervisorApiDoc::openapi())
        .merge(auth::rest_router())
        .split_for_parts();
    let rate_limited_auth = auth_only.layer(GovernorLayer::new(login_governor_config()));
    let public = health_only.merge(rate_limited_auth).merge(web::router());

    Router::new()
        .merge(protected)
        .merge(public)
        // Serve the OpenAPI document at `/openapi.json` so curl + Swagger UI
        // can introspect the live server's actual route surface (TECH-RUST-4).
        // Public route — no auth required.
        .merge(openapi_json_router())
        .layer(global_middleware())
        .with_state(state)
}

fn openapi_json_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    let openapi = SupervisorApiDoc::openapi();
    // Pre-serialize once at startup so each request is a cheap clone.
    let json = serde_json::to_string(&openapi)
        .unwrap_or_else(|_| String::from("{}"));
    Router::new().route(
        "/openapi.json",
        axum::routing::get(move || {
            let body = json.clone();
            async move {
                (
                    [(axum::http::header::CONTENT_TYPE, "application/json")],
                    body,
                )
            }
        }),
    )
}

/// Build the router served on the unix-socket listener. Anyone with file
/// permissions to the socket already has a local trust relationship with
/// the supervisor, so no bearer token is required — but handlers that
/// expect an `AuthContext` extension still need one, so we inject a
/// synthetic admin identity here.
fn unix_router(state: SharedState) -> Router {
    let (rest, _) = build_api_router().split_for_parts();
    rest.merge(vms::ws_router())
        .merge(agents::ws_router())
        .merge(web::router())
        .layer(axum::middleware::from_fn(auth_middleware::inject_unix_admin))
        .layer(global_middleware())
        .with_state(state)
}

pub async fn serve(state: SharedState) -> Result<()> {
    let unix_path = state.config.unix_socket.clone();
    let http_listen = state.config.http_listen;

    if state.config.api_token.is_none() {
        tracing::warn!(
            "MOWS_VM_SUPERVISOR_API_TOKEN is not set; the loopback HTTP listener \
             will only accept tokens issued by /v1/auth/login. Bootstrap the \
             first admin user via the unix socket before relying on HTTP."
        );
    }

    if let Some(parent) = unix_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    if tokio::fs::try_exists(&unix_path).await? {
        tokio::fs::remove_file(&unix_path).await?;
    }

    let unix_listener = UnixListener::bind(&unix_path)?;
    // 0660: owner + group access only. Container should bind-mount this socket
    // into a host directory the user owns or shares a group with.
    tokio::fs::set_permissions(&unix_path, std::fs::Permissions::from_mode(0o660)).await?;

    let unix_app = unix_router(Arc::clone(&state));
    let http_app = http_router(Arc::clone(&state));

    let unix_task = tokio::spawn(async move {
        tracing::info!(socket = %unix_path.display(), "unix listener up");
        axum::serve(unix_listener, unix_app.into_make_service())
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "unix listener exited");
            })
            .ok();
    });

    let tcp_listener = tokio::net::TcpListener::bind(http_listen).await?;
    tracing::info!(addr = %http_listen, "loopback http listener up");
    let http_task = tokio::spawn(async move {
        // `into_make_service_with_connect_info::<SocketAddr>()` is required
        // for `tower_governor`'s `PeerIpKeyExtractor` to find the peer IP
        // on the request. The plain `into_make_service()` form drops the
        // connect-info extension and the rate limiter fails closed with
        // a 500 ("Unable To Extract Key!") on every request that hits
        // the governor layer (i.e. `/v1/auth/login`).
        axum::serve(
            tcp_listener,
            http_app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
        )
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "http listener exited");
        })
        .ok();
    });

    tokio::select! {
        _ = unix_task => {},
        _ = http_task => {},
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("ctrl-c received, shutting down");
        }
    }
    Ok(())
}
