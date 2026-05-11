//! Route registration and OpenAPI doc for the manager HTTP API.
//!
//! Extracted from `src/main.rs` so that the same `OpenApiRouter` graph
//! drives both the live server and the build-time OpenAPI dump
//! (`src/bin/openapi_dump.rs`). The returned router is generic over its
//! state type (`()` here — manager doesn't use axum state extractors);
//! callers add middleware and the SPA fallback on top. Layers do not
//! contribute to the OpenAPI document.

use crate::api::{boot::*, direct_terminal::*, public_ip::*};
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "mows-manager", description = "Cluster management API")
    )
)]
pub struct ApiDoc;

pub fn build_api_router() -> OpenApiRouter {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        // machines
        .routes(routes!(crate::api::machines::delete_machine))
        .routes(routes!(crate::api::machines::create_machines))
        .routes(routes!(crate::api::machines::signal_machine))
        .routes(routes!(crate::api::machines::get_machine_info))
        .routes(routes!(crate::api::machines::get_vnc_websocket))
        .routes(routes!(crate::api::machines::get_machine_status))
        .routes(routes!(crate::api::machines::dev_delete_all_machines))
        // cluster
        .routes(routes!(
            crate::api::clusters::dev_create_cluster_from_all_machines_in_inventory
        ))
        .routes(routes!(crate::api::clusters::dev_install_cluster_basics))
        .routes(routes!(crate::api::clusters::get_cluster_status))
        .routes(routes!(crate::api::clusters::signal_cluster))
        // health
        .routes(routes!(crate::api::health::get_health))
        // config
        .routes(routes!(crate::api::config::update_config))
        .routes(routes!(crate::api::config::get_config))
        .routes(routes!(create_public_ip))
        .routes(routes!(get_boot_config_by_mac))
        .routes(routes!(direct_terminal))
}
