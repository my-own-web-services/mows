use anyhow::Context;
use axum::http::{
    header::{
        ACCEPT_RANGES, AUTHORIZATION, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_SECURITY_POLICY,
        CONTENT_TYPE,
    },
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
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration as StdDuration, Instant};
use tokio::sync::RwLock;
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
    // 60-second positive/negative cache so OPTIONS preflights don't
    // hammer the database. Keyed on the literal Origin header. The cache
    // also gives us a single place to enforce the origin deny-list
    // (`null`, non-http(s) schemes, wildcards, …) before the DB lookup.
    let cors_origin_cache: Arc<RwLock<HashMap<String, (bool, Instant)>>> =
        Arc::new(RwLock::new(HashMap::new()));

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
                        .allow_origin(AllowOrigin::async_predicate({
                            let cache = cors_origin_cache.clone();
                            move |origin: HeaderValue, _: &Parts| {
                                let db = database_for_cors_layer.clone();
                                let cache = cache.clone();
                                async move {
                                    let origin = match origin.to_str() {
                                        Ok(s) => s.to_string(),
                                        Err(_) => return false,
                                    };
                                    // Hard deny-list: never reflect the
                                    // serialized `null` origin (sandboxed
                                    // iframes / data: URLs), wildcards, or
                                    // any scheme that isn't http(s). With
                                    // `allow_credentials(true)` reflecting
                                    // any of these is a credential-leak.
                                    if !is_origin_eligible_for_credentials(&origin) {
                                        return false;
                                    }
                                    // Positive/negative cache (60s TTL).
                                    let now = Instant::now();
                                    {
                                        let read = cache.read().await;
                                        if let Some((allowed, at)) = read.get(&origin) {
                                            if now.duration_since(*at)
                                                < StdDuration::from_secs(60)
                                            {
                                                return *allowed;
                                            }
                                        }
                                    }
                                    let allowed =
                                        MowsApp::get_from_origin_string(&db, &origin)
                                            .await
                                            .is_ok();
                                    let mut write = cache.write().await;
                                    write.insert(origin, (allowed, now));
                                    allowed
                                }
                            }
                        }))
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
                        ])
                        // Expose Range-related headers so Shaka Player (and
                        // any other MSE-based reader) can read the byte
                        // ranges + total length when issuing range
                        // requests against /api/file_versions/content/get.
                        // Without these, DASH/HLS playback fails and
                        // progressive seek degrades.
                        .expose_headers([
                            ACCEPT_RANGES,
                            CONTENT_RANGE,
                            CONTENT_LENGTH,
                            CONTENT_TYPE,
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

/// Origin-string gate that runs BEFORE the `MowsApp` DB lookup. Filters
/// out values that the CORS spec allows on the wire but that we must
/// never reflect back with `Access-Control-Allow-Credentials: true`.
fn is_origin_eligible_for_credentials(origin: &str) -> bool {
    // The serialized opaque origin `null` (sandboxed iframes, file://,
    // data:) — reflecting this with credentials would let any document
    // with an opaque origin call us. Same for the wildcard.
    if origin == "null" || origin == "*" {
        return false;
    }
    // Only http(s) schemes are meaningful for browser CORS with cookies.
    let lower = origin.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return false;
    }
    // Bound the length so a pathological client can't blow up the cache
    // map with multi-MB keys.
    if origin.len() > 253 + 8 {
        return false;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::is_origin_eligible_for_credentials;

    #[test]
    fn rejects_null_and_wildcard_origins() {
        assert!(!is_origin_eligible_for_credentials("null"));
        assert!(!is_origin_eligible_for_credentials("*"));
    }

    #[test]
    fn rejects_non_http_schemes() {
        assert!(!is_origin_eligible_for_credentials("file://x"));
        assert!(!is_origin_eligible_for_credentials("data:text/plain,foo"));
        assert!(!is_origin_eligible_for_credentials("javascript:alert(1)"));
        assert!(!is_origin_eligible_for_credentials(""));
    }

    #[test]
    fn accepts_http_and_https() {
        assert!(is_origin_eligible_for_credentials("https://app.example.com"));
        assert!(is_origin_eligible_for_credentials("http://localhost:5173"));
    }

    #[test]
    fn rejects_overlong_origins() {
        let long = format!("https://{}.com", "a".repeat(300));
        assert!(!is_origin_eligible_for_credentials(&long));
    }
}
