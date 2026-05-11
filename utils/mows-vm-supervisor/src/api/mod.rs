//! HTTP + unix-socket API.
//!
//! Two listeners are exposed:
//! - **Unix socket** at `config.unix_socket` — local trust domain, no auth
//!   required (process uid is enough).
//! - **Loopback HTTP** at `config.http_listen` — token auth via the
//!   `Authorization: Bearer <token>` header where the token comes from
//!   `MOWS_VM_SUPERVISOR_API_TOKEN[_FILE]`.
//!
//! HTTPS on the WireGuard interface is planned but not wired in v1.

use std::os::unix::fs::PermissionsExt;
use std::sync::Arc;

use axum::Router;
use tokio::net::UnixListener;

use crate::error::Result;
use crate::state::SharedState;

mod agents;
mod auth;
mod health;
mod users;
mod vms;
mod web;

pub fn router(state: SharedState) -> Router {
    Router::new()
        .merge(health::router())
        .merge(auth::router())
        .merge(vms::router())
        .merge(agents::router())
        .merge(users::router())
        // Web UI fallback last — the API merges above are explicit routes,
        // so the SPA only catches GETs that don't match any /v1 path.
        .merge(web::router())
        .with_state(state)
}

pub async fn serve(state: SharedState) -> Result<()> {
    let unix_path = state.config.unix_socket.clone();
    let http_listen = state.config.http_listen;

    if unix_path.exists() {
        std::fs::remove_file(&unix_path)?;
    }
    if let Some(parent) = unix_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let unix_listener = UnixListener::bind(&unix_path)?;
    // 0660: owner + group access only. Container should bind-mount this socket
    // into a host directory the user owns or shares a group with.
    std::fs::set_permissions(&unix_path, std::fs::Permissions::from_mode(0o660))?;

    let app = router(Arc::clone(&state));
    let app_unix = app.clone();

    let unix_task = tokio::spawn(async move {
        tracing::info!(socket = %unix_path.display(), "unix listener up");
        axum::serve(unix_listener, app_unix.into_make_service())
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "unix listener exited");
            })
            .ok();
    });

    let tcp_listener = tokio::net::TcpListener::bind(http_listen).await?;
    tracing::info!(addr = %http_listen, "loopback http listener up");
    let http_task = tokio::spawn(async move {
        axum::serve(tcp_listener, app.into_make_service())
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
