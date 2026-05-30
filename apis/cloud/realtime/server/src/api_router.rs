//! `utoipa-axum` router composition for realtime-server.

use axum::routing::get;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    http_api::{channels, dev, health, policies},
    state::AppState,
    types::RealtimeApiDoc,
};

pub fn build_api_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::with_openapi(<RealtimeApiDoc as utoipa::OpenApi>::openapi())
        .routes(routes!(health::health))
        .routes(routes!(channels::create::create_channel))
        .routes(routes!(channels::get::get_channel))
        .routes(routes!(channels::list::list_channels))
        .routes(routes!(channels::update::update_channel))
        .routes(routes!(channels::delete::delete_channel))
        .routes(routes!(channels::events::list::list_events))
        .routes(routes!(channels::events::publish::publish_event))
        .routes(routes!(policies::create::create_policy))
        .routes(routes!(policies::list::list_policies))
        .routes(routes!(policies::delete::delete_policy))
        .routes(routes!(dev::seed::dev_seed))
        // WebSocket endpoint — registered via raw `route()`
        // because utoipa-axum's `routes!` expects a `#[utoipa::path]`
        // and OpenAPI doesn't model WebSocket upgrades cleanly.
        .route(
            "/api/channels/{channel_id}/live",
            get(channels::live::channel_live),
        )
}
